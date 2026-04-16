export enum InvoiceType {
  PAYABLE = 'PAYABLE',
  RECEIVABLE = 'RECEIVABLE',
}

export enum InvoiceStatus {
  OCR_PENDING = 'OCR_PENDING',
  OCR_PROCESSING = 'OCR_PROCESSING',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  PAID = 'PAID',
  VOID = 'VOID',
  OCR_FAILED = 'OCR_FAILED',
}

export enum ThreeWayMatchStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  MISMATCHED = 'MISMATCHED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export enum OcrProvider {
  TEXTRACT = 'TEXTRACT',
  TESSERACT = 'TESSERACT',
}

export enum OcrStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class UnsupportedInvoiceFileException extends Error {
  constructor(message = 'Only PDF, JPG, and PNG invoice documents are supported for OCR upload.') {
    super(message);
    this.name = 'UnsupportedInvoiceFileException';
  }
}

export class InvoiceMatchFailedException extends Error {
  constructor(message = 'Invoice matching failed. Review the purchase order, goods receipt, and invoice data before retrying.') {
    super(message);
    this.name = 'InvoiceMatchFailedException';
  }
}

export class InvoicePostingConfigurationException extends Error {
  constructor(message = 'Invoice posting cannot continue until the required vendor or customer control account is configured.') {
    super(message);
    this.name = 'InvoicePostingConfigurationException';
  }
}

export class InvoiceOcrFailedException extends Error {
  constructor(message = 'Invoice OCR failed. The source document remains available for manual review and retry.') {
    super(message);
    this.name = 'InvoiceOcrFailedException';
  }
}
