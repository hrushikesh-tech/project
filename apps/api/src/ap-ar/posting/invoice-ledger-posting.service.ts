import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoicePostingConfigurationException } from '@amdox/types';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceService } from '../../finance/finance.service';

@Injectable()
export class InvoiceLedgerPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  async postMatchedPayableInvoice(tenantId: string, invoiceId: string) {
    const db = this.prisma.forTenant(tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        vendor: true,
        lines: true,
        threeWayMatch: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.type !== 'PAYABLE') {
      return invoice;
    }

    if (invoice.threeWayMatch?.matchStatus !== 'MATCHED') {
      throw new InvoicePostingConfigurationException(
        'Invoice posting is only allowed after a successful payable match.',
      );
    }

    if (!invoice.vendor?.payablesAccountId) {
      throw new InvoicePostingConfigurationException();
    }

    const entityAccounts = await db.account.findMany({
      where: {
        legalEntityId: invoice.legalEntityId,
      },
    });
    const recognitionAccount =
      entityAccounts.find(
        (account) =>
          account.id !== invoice.vendor?.payablesAccountId &&
          account.isActive &&
          !account.deletedAt &&
          account.type === 'EXPENSE',
      ) ??
      entityAccounts.find(
        (account) =>
          account.id !== invoice.vendor?.payablesAccountId &&
          account.isActive &&
          !account.deletedAt &&
          account.type === 'ASSET',
      );

    if (!recognitionAccount || recognitionAccount.id === invoice.vendor.payablesAccountId) {
      throw new InvoicePostingConfigurationException(
        'Invoice posting requires an expense or inventory recognition account in the same legal entity.',
      );
    }

    const periods = await db.fiscalPeriod.findMany({
      where: { legalEntityId: invoice.legalEntityId },
    });
    const postingPeriod = periods.find(
      (period) =>
        !period.isClosed &&
        period.startDate <= invoice.issueDate &&
        period.endDate >= invoice.issueDate,
    );

    if (!postingPeriod) {
      throw new InvoicePostingConfigurationException(
        'Invoice posting requires an open fiscal period covering the invoice issue date.',
      );
    }

    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'APPROVED',
        reviewReason: null,
      },
    });

    const journalEntry = await this.financeService.createJournalEntry({
      legalEntityId: invoice.legalEntityId,
      periodId: postingPeriod.id,
      date: invoice.issueDate.toISOString(),
      description: `AP invoice ${invoice.invoiceNumber}`,
      lines: [
        {
          accountId: recognitionAccount.id,
          debitAmountMinor: Number(invoice.totalAmount),
          currency: invoice.currency,
        },
        {
          accountId: invoice.vendor.payablesAccountId,
          creditAmountMinor: Number(invoice.totalAmount),
          currency: invoice.currency,
        },
      ],
    });

    await this.financeService.postJournalEntry(journalEntry.id);

    return db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'POSTED',
        postedJournalEntryId: journalEntry.id,
      },
      include: {
        postedJournalEntry: true,
      },
    });
  }

  async validateReceivablePostingConfiguration(tenantId: string, invoiceId: string) {
    const db = this.prisma.forTenant(tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.type !== 'RECEIVABLE') {
      return invoice;
    }

    if (!invoice.customer?.receivablesAccountId) {
      throw new InvoicePostingConfigurationException(
        'Receivable invoices require an explicit customer receivables control account before posting.',
      );
    }

    return invoice;
  }
}
