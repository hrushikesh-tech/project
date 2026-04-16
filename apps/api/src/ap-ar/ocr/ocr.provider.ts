export interface OcrLineItem {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  taxRate?: number;
}

export interface OcrExtractionResult {
  counterpartyName?: string | null;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  poNumber?: string | null;
  taxAmountMinor?: number | null;
  totalAmountMinor?: number | null;
  lineItems: OcrLineItem[];
  rawPayload: unknown;
}

export interface OcrDocumentInput {
  invoiceId: string;
  mimeType: string;
  sourceBuffer: Buffer;
}

export interface InvoiceOcrProvider {
  readonly name: string;
  isAvailable(): boolean;
  extract(input: OcrDocumentInput): Promise<OcrExtractionResult>;
}

export const OCR_PROVIDERS = Symbol('OCR_PROVIDERS');
