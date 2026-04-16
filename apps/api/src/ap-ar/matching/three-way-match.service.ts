import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amdox/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ThreeWayMatchService {
  constructor(private readonly prisma: PrismaService) {}

  async matchInvoice(tenantId: string, invoiceId: string) {
    const db = this.prisma.forTenant(tenantId);
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        lines: true,
        purchaseOrder: {
          include: {
            lines: true,
            vendor: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (invoice.type !== 'PAYABLE') {
      return {
        invoice,
        purchaseOrder: invoice.purchaseOrder ?? null,
        goodsReceipts: [],
        matchStatus: 'MANUAL_REVIEW',
        amountMatch: false,
        quantityMatch: false,
        lineItemSimilarity: new Prisma.Decimal('0'),
        variancePercent: null,
        mismatchReasons: ['Receivable invoices stay review-first in Phase 4.'],
      };
    }

    const purchaseOrder =
      invoice.purchaseOrder ??
      (invoice.poNumber
        ? await db.purchaseOrder.findFirst({
            where: { poNumber: invoice.poNumber, deletedAt: null },
            include: {
              lines: true,
              vendor: true,
            },
          })
        : null);

    const mismatchReasons: string[] = [];

    if (!purchaseOrder) {
      mismatchReasons.push('Purchase order context is missing.');
      return this.persistMatchResult(db, invoice, null, [], {
        matchStatus: 'MISMATCHED',
        amountMatch: false,
        quantityMatch: false,
        lineItemSimilarity: new Prisma.Decimal('0'),
        variancePercent: null,
        mismatchReasons,
      });
    }

    const goodsReceipts = await db.goodsReceipt.findMany({
      where: { purchaseOrderId: purchaseOrder.id, deletedAt: null },
      include: { lines: true },
    });

    const variancePercent = calculateVariancePercent(invoice.totalAmount, purchaseOrder.totalAmount);
    const amountMatch = variancePercent.lte(new Prisma.Decimal('1'));

    if (!amountMatch) {
      mismatchReasons.push(`Amount variance exceeds 1%. Actual variance: ${variancePercent.toString()}%.`);
    }

    const { averageSimilarity, quantityMatch } = evaluateLineMatching(
      invoice.lines,
      purchaseOrder.lines ?? [],
      goodsReceipts,
    );

    if (!quantityMatch) {
      mismatchReasons.push('Received quantities do not cover the invoiced quantities.');
    }
    if (averageSimilarity.lt(new Prisma.Decimal('0.85'))) {
      mismatchReasons.push(
        `Line similarity is below 0.85. Actual similarity: ${averageSimilarity.toString()}.`,
      );
    }

    const matchStatus = mismatchReasons.length === 0 ? 'MATCHED' : 'MISMATCHED';

    return this.persistMatchResult(db, invoice, purchaseOrder, goodsReceipts, {
      matchStatus,
      amountMatch,
      quantityMatch,
      lineItemSimilarity: averageSimilarity,
      variancePercent,
      mismatchReasons,
    });
  }

  private async persistMatchResult(
    db: any,
    invoice: any,
    purchaseOrder: any,
    goodsReceipts: any[],
    payload: any,
  ) {
    const existing = await db.threeWayMatch.findFirst({
      where: { invoiceId: invoice.id },
    });

    const data = {
      invoiceId: invoice.id,
      purchaseOrderId: purchaseOrder?.id ?? existing?.purchaseOrderId ?? invoice.purchaseOrderId,
      goodsReceiptId: goodsReceipts[0]?.id ?? existing?.goodsReceiptId,
      matchStatus: payload.matchStatus,
      amountMatch: payload.amountMatch,
      quantityMatch: payload.quantityMatch,
      lineItemSimilarity: payload.lineItemSimilarity,
      variancePercent: payload.variancePercent,
      mismatchReasons: payload.mismatchReasons,
      matchedAt: payload.matchStatus === 'MATCHED' ? new Date() : null,
      reviewedAt: null,
      reviewedBy: null,
    };

    const matchRecord = existing
      ? await db.threeWayMatch.update({
          where: { id: existing.id },
          data,
        })
      : await db.threeWayMatch.create({
          data,
        });

    return {
      invoice,
      purchaseOrder,
      goodsReceipts,
      ...payload,
      matchRecord,
    };
  }
}

function calculateVariancePercent(invoiceTotal: bigint, poTotal: bigint) {
  if (poTotal === 0n) {
    return new Prisma.Decimal(invoiceTotal === 0n ? '0' : '100');
  }

  return new Prisma.Decimal((invoiceTotal > poTotal ? invoiceTotal - poTotal : poTotal - invoiceTotal).toString())
    .div(new Prisma.Decimal(poTotal.toString()))
    .mul(new Prisma.Decimal('100'))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function evaluateLineMatching(invoiceLines: any[], purchaseOrderLines: any[], goodsReceipts: any[]) {
  if (!invoiceLines.length || !purchaseOrderLines.length) {
    return {
      averageSimilarity: new Prisma.Decimal('0'),
      quantityMatch: false,
    };
  }

  const receiptQuantityByLineId = new Map();
  for (const goodsReceipt of goodsReceipts) {
    for (const line of goodsReceipt.lines ?? []) {
      const current = receiptQuantityByLineId.get(line.purchaseOrderLineId) ?? new Prisma.Decimal('0');
      receiptQuantityByLineId.set(
        line.purchaseOrderLineId,
        current.add(new Prisma.Decimal(line.quantityReceived.toString())),
      );
    }
  }

  const similarities = [];
  let quantityMatch = true;

  for (const invoiceLine of invoiceLines) {
    let bestSimilarity = new Prisma.Decimal('0');
    let matchedLine = null;

    for (const poLine of purchaseOrderLines) {
      const similarity = new Prisma.Decimal(
        calculateTokenSimilarity(invoiceLine.description, poLine.description).toFixed(2),
      );
      if (similarity.gt(bestSimilarity)) {
        bestSimilarity = similarity;
        matchedLine = poLine;
      }
    }

    similarities.push(bestSimilarity);

    if (!matchedLine) {
      quantityMatch = false;
      continue;
    }

    const receivedQuantity =
      receiptQuantityByLineId.get(matchedLine.id) ??
      new Prisma.Decimal(matchedLine.receivedQuantity.toString());

    if (receivedQuantity.lt(new Prisma.Decimal(invoiceLine.quantity.toString()))) {
      quantityMatch = false;
    }
  }

  const total = similarities.reduce(
    (sum, current) => sum.add(current),
    new Prisma.Decimal('0'),
  );
  const averageSimilarity = total.div(new Prisma.Decimal(String(similarities.length)));

  return {
    averageSimilarity,
    quantityMatch,
  };
}

function calculateTokenSimilarity(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : overlap / union;
}

function tokenize(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}
