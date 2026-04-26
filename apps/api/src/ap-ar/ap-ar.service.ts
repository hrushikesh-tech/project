import { randomUUID } from 'node:crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { fileTypeFromBuffer } from 'file-type';
import { ClsService } from 'nestjs-cls';
import {
  InvoiceMatchFailedException,
  InvoicePostingConfigurationException,
  UnsupportedInvoiceFileException,
} from '@amdox/types';
import { Prisma } from '@amdox/db';
import { PrismaService } from '../prisma/prisma.service';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { ReviewInvoiceDto } from './dto/review-invoice.dto';
import { ThreeWayMatchService } from './matching/three-way-match.service';
import { OcrMapperService } from './ocr/ocr-mapper.service';
import { OcrExtractionResult } from './ocr/ocr.provider';
import { InvoiceLedgerPostingService } from './posting/invoice-ledger-posting.service';
import { AgingReportService } from './reports/aging-report.service';
import { InvoiceStorageService } from './storage/invoice-storage.service';
import {
  INVOICE_OCR_JOB,
  INVOICE_OCR_QUEUE,
  InvoiceOcrJobPayload,
} from './queue/invoice-ocr.queue';
import { areBackgroundQueuesEnabled } from '../common/queue/queue-runtime';

export interface UploadedInvoiceFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

@Injectable()
export class ApArService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly storageService: InvoiceStorageService,
    private readonly ocrMapperService: OcrMapperService,
    private readonly threeWayMatchService: ThreeWayMatchService,
    private readonly invoiceLedgerPostingService: InvoiceLedgerPostingService,
    private readonly agingReportService: AgingReportService,
    @Optional()
    @InjectQueue(INVOICE_OCR_QUEUE)
    private readonly invoiceOcrQueue?: Queue<InvoiceOcrJobPayload>,
  ) {}

  async uploadInvoice(dto: UploadInvoiceDto, file: UploadedInvoiceFile) {
    this.assertInvoiceOcrQueueAvailable();
    const tenantId = this.requireTenantId();
    this.assertUploadPresent(file);
    const detectedMimeType = await this.detectMimeType(file);
    const extension = EXTENSION_BY_MIME_TYPE[detectedMimeType];
    const invoiceId = randomUUID();
    const legalEntity = await this.ensureLegalEntity(tenantId, dto.legalEntityId);
    const counterparty = await this.resolveCounterparty(tenantId, dto, legalEntity.id);
    const issueDate = new Date();
    const dueDate = this.deriveDueDate(issueDate, counterparty.paymentTerms);

    const storage = await this.storageService.uploadInvoiceSource({
      tenantId,
      invoiceId,
      extension,
      contentType: detectedMimeType,
      body: file.buffer,
    });

    const invoice = await this.prisma.tenant.invoice.create({
      data: {
        id: invoiceId,
        tenantId,
        legalEntityId: legalEntity.id,
        vendorId: dto.type === 'PAYABLE' ? dto.vendorId ?? null : null,
        customerId: dto.type === 'RECEIVABLE' ? dto.customerId ?? null : null,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        type: dto.type,
        status: 'OCR_PENDING',
        invoiceNumber: `OCR-${invoiceId.slice(0, 8).toUpperCase()}`,
        issueDate,
        totalAmount: 0n,
        taxAmount: 0n,
        currency: legalEntity.baseCurrency,
        dueDate,
        poNumber: dto.poNumber ?? null,
        sourceDocumentKey: storage.key,
        sourceDocumentMimeType: detectedMimeType,
        ocrStatus: 'QUEUED',
        counterpartyName: counterparty.name,
      },
    });

    const queuedAt = new Date().toISOString();

    await this.invoiceOcrQueue.add(
      INVOICE_OCR_JOB,
      {
        tenantId,
        invoiceId: invoice.id,
        sourceDocumentKey: storage.key,
        sourceDocumentMimeType: detectedMimeType,
      },
      {
        jobId: invoice.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );

    return {
      invoiceId: invoice.id,
      status: invoice.status,
      ocrStatus: invoice.ocrStatus,
      queuedAt,
    };
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.tenant.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        vendor: true,
        customer: true,
        purchaseOrder: true,
        lines: true,
        postedJournalEntry: true,
        threeWayMatch: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return invoice;
  }

  async persistOcrExtraction(params: {
    tenantId: string;
    invoiceId: string;
    providerName: string;
    extraction: OcrExtractionResult;
  }) {
    const db = this.prisma.forTenant(params.tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: params.invoiceId },
      include: { lines: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.ocrStatus === 'COMPLETED' || invoice.status === 'POSTED') {
      return {
        skipped: true,
        invoiceId: invoice.id,
      };
    }

    const mapped = this.ocrMapperService.mapExtraction(params.extraction);
    const linkedPurchaseOrderId = await this.resolvePurchaseOrderId(
      db,
      mapped.poNumber ?? invoice.poNumber,
      invoice.purchaseOrderId,
    );

    await db.invoiceLine.deleteMany({
      where: { invoiceId: invoice.id },
    });

    if (mapped.lines.length > 0) {
      await db.invoiceLine.createMany({
        data: mapped.lines.map((line) => ({
          tenantId: params.tenantId,
          invoiceId: invoice.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
          taxRate: line.taxRate,
        })),
      });
    }

    return db.invoice.update({
      where: { id: invoice.id },
      data: {
        invoiceNumber: mapped.invoiceNumber ?? invoice.invoiceNumber,
        issueDate: mapped.issueDate ?? invoice.issueDate,
        dueDate: mapped.dueDate ?? invoice.dueDate,
        poNumber: mapped.poNumber ?? invoice.poNumber,
        purchaseOrderId: linkedPurchaseOrderId,
        totalAmount: mapped.totalAmount || invoice.totalAmount,
        taxAmount: mapped.taxAmount || invoice.taxAmount,
        status: 'PENDING_REVIEW',
        ocrStatus: 'COMPLETED',
        ocrProvider: params.providerName,
        reviewReason:
          mapped.invoiceNumber && mapped.totalAmount > 0n
            ? null
            : 'OCR completed with partial extraction. Finance review is required.',
        counterpartyName: mapped.counterpartyName ?? invoice.counterpartyName,
        ocrData: mapped.ocrData as Prisma.InputJsonValue,
      },
      include: {
        lines: true,
        purchaseOrder: true,
      },
    });
  }

  async markOcrFailure(params: {
    tenantId: string;
    invoiceId: string;
    providerName?: string;
    reason: string;
  }) {
    const db = this.prisma.forTenant(params.tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: params.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PENDING_REVIEW',
        ocrStatus: 'FAILED',
        ocrProvider: params.providerName ?? invoice.ocrProvider,
        reviewReason: params.reason,
      },
    });
  }

  async handlePostOcrWorkflow(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.forTenant(tenantId).invoice.findFirst({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.type === 'RECEIVABLE') {
      try {
        await this.invoiceLedgerPostingService.validateReceivablePostingConfiguration(tenantId, invoiceId);
      } catch (error) {
        if (error instanceof InvoicePostingConfigurationException) {
          await this.prisma.forTenant(tenantId).invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'PENDING_REVIEW',
              reviewReason: error.message,
            },
          });
        }
      }
      return this.getInvoice(invoiceId);
    }

    if (!invoice.purchaseOrderId && !invoice.poNumber) {
      return this.getInvoice(invoiceId);
    }

    return this.matchInvoice(invoiceId);
  }

  async markOcrProcessing(tenantId: string, invoiceId: string) {
    const db = this.prisma.forTenant(tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.ocrStatus === 'COMPLETED' || invoice.status === 'POSTED') {
      return invoice;
    }

    return db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'OCR_PROCESSING',
        ocrStatus: 'PROCESSING',
      },
    });
  }

  async matchInvoice(invoiceId: string) {
    const tenantId = this.requireTenantId();
    return this.matchInvoiceForTenant(tenantId, invoiceId);
  }

  async matchInvoiceForTenant(tenantId: string, invoiceId: string) {
    const result = await this.threeWayMatchService.matchInvoice(tenantId, invoiceId);

    if (result.matchStatus === 'MATCHED') {
      const posted = await this.invoiceLedgerPostingService.postMatchedPayableInvoice(
        tenantId,
        invoiceId,
      );
      return {
        ...result,
        invoice: posted,
      };
    }

    await this.persistMismatchArtifacts(tenantId, invoiceId, result);
    throw new InvoiceMatchFailedException(result.mismatchReasons.join(' '));
  }

  async reviewInvoice(invoiceId: string, dto: ReviewInvoiceDto) {
    const tenantId = this.requireTenantId();
    const db = this.prisma.forTenant(tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      include: { threeWayMatch: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (dto.action === 'RETRY_MATCH') {
      return this.matchInvoiceForTenant(tenantId, invoiceId);
    }

    if (dto.action === 'REJECT') {
      return db.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VOID',
          reviewReason: dto.reason ?? 'Invoice rejected during manual review.',
        },
      });
    }

    if (invoice.type === 'PAYABLE') {
      return this.invoiceLedgerPostingService.postMatchedPayableInvoice(tenantId, invoiceId);
    }

    return db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'APPROVED',
        reviewReason: dto.reason ?? null,
      },
    });
  }

  async getAgingReport(query: AgingReportQueryDto) {
    return this.agingReportService.getReport(query);
  }

  private requireTenantId() {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId || tenantId === '*') {
      throw new BadRequestException('AP/AR endpoints require a tenant-scoped request context.');
    }
    return tenantId;
  }

  private assertInvoiceOcrQueueAvailable() {
    if (!areBackgroundQueuesEnabled() || !this.invoiceOcrQueue) {
      throw new ServiceUnavailableException(
        'Invoice OCR processing is unavailable because Redis-backed background queues are disabled.',
      );
    }
  }

  private assertUploadPresent(file?: UploadedInvoiceFile | null): asserts file is UploadedInvoiceFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Invoice source file is required.');
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new PayloadTooLargeException('Invoice upload cannot exceed 10MB.');
    }
  }

  private async detectMimeType(file: UploadedInvoiceFile) {
    const detected = await fileTypeFromBuffer(file.buffer);
    const mimeType = detected?.mime || file.mimetype;

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new UnsupportedInvoiceFileException();
    }

    return mimeType;
  }

  private async ensureLegalEntity(tenantId: string, legalEntityId: string) {
    const legalEntity = await this.prisma.tenant.legalEntity.findFirst({
      where: { id: legalEntityId, tenantId, deletedAt: null },
    });

    if (!legalEntity) {
      throw new NotFoundException('Legal entity not found.');
    }

    return legalEntity;
  }

  private async resolveCounterparty(tenantId: string, dto: UploadInvoiceDto, legalEntityId: string) {
    if (dto.type === 'PAYABLE') {
      if (!dto.vendorId) {
        return { name: 'Unassigned Vendor', paymentTerms: 30 };
      }

      const vendor = await this.prisma.tenant.vendor.findFirst({
        where: {
          id: dto.vendorId,
          tenantId,
          legalEntityId,
          deletedAt: null,
        },
      });
      if (!vendor) {
        throw new NotFoundException('Vendor not found.');
      }
      return { name: vendor.name, paymentTerms: vendor.paymentTerms };
    }

    if (!dto.customerId) {
      return { name: 'Unassigned Customer', paymentTerms: 30 };
    }

    const customer = await this.prisma.tenant.customer.findFirst({
      where: {
        id: dto.customerId,
        tenantId,
        legalEntityId,
        deletedAt: null,
      },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return { name: customer.name, paymentTerms: customer.paymentTerms };
  }

  private deriveDueDate(issueDate: Date, paymentTerms: number) {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (paymentTerms || 30));
    return dueDate;
  }

  private async resolvePurchaseOrderId(
    db: ReturnType<PrismaService['forTenant']>,
    poNumber: string | null,
    purchaseOrderId: string | null,
  ) {
    if (purchaseOrderId) {
      return purchaseOrderId;
    }

    if (!poNumber) {
      return null;
    }

    const purchaseOrder = await db.purchaseOrder.findFirst({
      where: { poNumber, deletedAt: null },
    });
    return purchaseOrder?.id ?? null;
  }

  private async persistMismatchArtifacts(tenantId: string, invoiceId: string, result: any) {
    const db = this.prisma.forTenant(tenantId);
    const reviewReason = result.mismatchReasons.join(' ');
    const goodsReceiptIds = result.goodsReceipts.map((receipt: any) => receipt.id);

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PENDING_REVIEW',
        reviewReason,
      },
    });

    await db.outboxEvent.create({
      data: {
        tenantId,
        eventType: 'invoice.match_failed',
        payload: {
          tenantId,
          invoiceId,
          purchaseOrderId: result.purchaseOrder?.id ?? null,
          goodsReceiptIds,
          mismatchReasons: result.mismatchReasons,
        },
        status: 'PENDING',
      },
    });

    const financeUsers = await db.user.findMany({
      where: {
        role: 'finance_manager',
        isActive: true,
        deletedAt: null,
      },
    });

    if (financeUsers.length > 0) {
      await db.notification.createMany({
        data: financeUsers.map((user) => ({
          tenantId,
          userId: user.id,
          type: 'invoice.match_failed',
          channel: 'IN_APP',
          title: 'Invoice review required',
          body: reviewReason,
          metadata: {
            invoiceId,
            purchaseOrderId: result.purchaseOrder?.id ?? null,
            mismatchReasons: result.mismatchReasons,
          },
        })),
      });
    }
  }
}
