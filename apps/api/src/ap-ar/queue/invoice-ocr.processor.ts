import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  InvoiceMatchFailedException,
  InvoiceOcrFailedException,
  InvoicePostingConfigurationException,
} from '@amdox/types';
import { ApArService } from '../ap-ar.service';
import { OCR_PROVIDERS, InvoiceOcrProvider } from '../ocr/ocr.provider';
import { InvoiceStorageService } from '../storage/invoice-storage.service';
import {
  INVOICE_OCR_QUEUE,
  InvoiceOcrJobPayload,
} from './invoice-ocr.queue';

@Injectable()
@Processor(INVOICE_OCR_QUEUE)
export class InvoiceOcrProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceOcrProcessor.name);

  constructor(
    private readonly apArService: ApArService,
    private readonly storageService: InvoiceStorageService,
    @Inject(OCR_PROVIDERS)
    private readonly ocrProviders: InvoiceOcrProvider[],
  ) {
    super();
  }

  async process(job: Job<InvoiceOcrJobPayload>) {
    const invoice = await this.apArService.markOcrProcessing(job.data.tenantId, job.data.invoiceId);
    if (invoice.ocrStatus === 'COMPLETED' || invoice.status === 'POSTED') {
      return {
        skipped: true,
        invoiceId: job.data.invoiceId,
      };
    }

    const sourceBuffer = await this.storageService.getInvoiceSourceBuffer(job.data.sourceDocumentKey);
    const errors: string[] = [];

    for (const provider of this.orderedProviders()) {
      if (!provider.isAvailable()) {
        continue;
      }

      try {
        const extraction = await provider.extract({
          invoiceId: job.data.invoiceId,
          mimeType: job.data.sourceDocumentMimeType,
          sourceBuffer,
        });

        const persisted = await this.apArService.persistOcrExtraction({
          tenantId: job.data.tenantId,
          invoiceId: job.data.invoiceId,
          providerName: provider.name,
          extraction,
        });

        let workflow: unknown = null;
        try {
          workflow = await this.apArService.handlePostOcrWorkflow(
            job.data.tenantId,
            job.data.invoiceId,
          );
        } catch (error) {
          if (
            error instanceof InvoiceMatchFailedException ||
            error instanceof InvoicePostingConfigurationException
          ) {
            workflow = {
              reviewRequired: true,
              reason: error.message,
            };
          } else {
            throw error;
          }
        }

        return {
          provider: provider.name,
          invoiceId: job.data.invoiceId,
          result: persisted,
          workflow,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `OCR provider ${provider.name} failed for invoice ${job.data.invoiceId}: ${message}`,
        );
        errors.push(`${provider.name}: ${message}`);
      }
    }

    const reason =
      errors.length > 0
        ? `OCR failed after provider fallback. ${errors.join(' | ')}`
        : 'OCR failed because no configured provider was available.';

    await this.apArService.markOcrFailure({
      tenantId: job.data.tenantId,
      invoiceId: job.data.invoiceId,
      reason,
    });

    throw new InvoiceOcrFailedException(reason);
  }

  private orderedProviders() {
    return [...this.ocrProviders].sort((left, right) => {
      if (left.name === 'TEXTRACT') {
        return -1;
      }
      if (right.name === 'TEXTRACT') {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });
  }
}
