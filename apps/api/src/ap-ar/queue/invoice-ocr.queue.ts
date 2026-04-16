export const INVOICE_OCR_QUEUE = 'invoice-ocr';
export const INVOICE_OCR_JOB = 'process-invoice-ocr';

export interface InvoiceOcrJobPayload {
  tenantId: string;
  invoiceId: string;
  sourceDocumentKey: string;
  sourceDocumentMimeType: string;
}
