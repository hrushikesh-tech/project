import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgingReportQueryDto } from '../dto/aging-report-query.dto';

@Injectable()
export class AgingReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(query: AgingReportQueryDto) {
    const invoices = await this.prisma.tenant.invoice.findMany({
      where: {
        legalEntityId: query.legalEntityId,
        type: query.type,
        vendorId: query.vendorId,
        customerId: query.customerId,
        deletedAt: null,
      },
      include: {
        vendor: true,
        customer: true,
      },
    });

    const asOfDate = new Date(query.asOfDate);
    const summary = {
      current: 0n,
      bucket30: 0n,
      bucket60: 0n,
      over60: 0n,
    };

    const rows = invoices
      .filter((invoice) => !['PAID', 'VOID'].includes(invoice.status))
      .map((invoice) => {
        const daysPastDue = Math.floor(
          (asOfDate.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        const bucket = resolveBucket(daysPastDue);

        if (bucket === 'current') summary.current += invoice.totalAmount;
        if (bucket === '30') summary.bucket30 += invoice.totalAmount;
        if (bucket === '60') summary.bucket60 += invoice.totalAmount;
        if (bucket === 'over60') summary.over60 += invoice.totalAmount;

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          counterpartyName:
            invoice.counterpartyName ??
            invoice.vendor?.name ??
            invoice.customer?.name ??
            'Unknown Counterparty',
          dueDate: invoice.dueDate.toISOString(),
          status: invoice.status,
          daysPastDue,
          bucket,
          openAmountMinor: invoice.totalAmount.toString(),
        };
      });

    return {
      legalEntityId: query.legalEntityId,
      type: query.type,
      asOfDate: asOfDate.toISOString(),
      summary: {
        current: summary.current.toString(),
        bucket30: summary.bucket30.toString(),
        bucket60: summary.bucket60.toString(),
        over60: summary.over60.toString(),
      },
      rows,
    };
  }
}

function resolveBucket(daysPastDue: number) {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '30';
  if (daysPastDue <= 60) return '60';
  return 'over60';
}
