import { Injectable } from '@nestjs/common';
import { OcrExtractionResult } from './ocr.provider';

@Injectable()
export class OcrMapperService {
  mapExtraction(result: OcrExtractionResult) {
    const normalizedLines = result.lineItems.map((line) => ({
      description: line.description.trim(),
      quantity: String(line.quantity || 0),
      unitPrice: BigInt(line.unitPriceMinor || 0),
      amount: BigInt(line.amountMinor || 0),
      taxRate: String(line.taxRate || 0),
    }));

    return {
      counterpartyName: result.counterpartyName?.trim() || null,
      invoiceNumber: result.invoiceNumber?.trim() || null,
      issueDate: result.issueDate ? new Date(result.issueDate) : null,
      dueDate: result.dueDate ? new Date(result.dueDate) : null,
      poNumber: result.poNumber?.trim() || null,
      taxAmount: BigInt(result.taxAmountMinor || 0),
      totalAmount: BigInt(result.totalAmountMinor || 0),
      lines: normalizedLines,
      ocrData: result.rawPayload,
    };
  }
}
