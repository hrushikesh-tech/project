import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { InvoiceOcrFailedException } from '@amdox/types';
import { createAparHarness } from '../helpers/apar-test-store.mjs';

const require = createRequire(import.meta.url);
const { ApArService } = require('../../dist/src/ap-ar/ap-ar.service.js');
const { OcrMapperService } = require('../../dist/src/ap-ar/ocr/ocr-mapper.service.js');
const { InvoiceOcrProcessor } = require('../../dist/src/ap-ar/queue/invoice-ocr.processor.js');

function createProcessorHarness() {
  const harness = createAparHarness();
  const storageCalls = [];
  const storageService = {
    async getInvoiceSourceBuffer(sourceDocumentKey) {
      storageCalls.push(sourceDocumentKey);
      return Buffer.from('%PDF-1.4\nseed');
    },
  };
  const queue = { async add() {} };
  const service = new ApArService(
    harness.prisma,
    harness.cls,
    storageService,
    new OcrMapperService(),
    { async matchInvoice() {} },
    { async postMatchedPayableInvoice() {}, async validateReceivablePostingConfiguration() {} },
    { async getReport() {} },
    queue,
  );

  return {
    harness,
    storageService,
    storageCalls,
    service,
  };
}

function createJob(invoice) {
  return {
    data: {
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      sourceDocumentKey: invoice.sourceDocumentKey,
      sourceDocumentMimeType: invoice.sourceDocumentMimeType,
    },
  };
}

test('processor prefers Textract when available', async () => {
  const { harness, service, storageService } = createProcessorHarness();
  const invoice = harness.insertInvoice();
  let tesseractCalls = 0;
  const processor = new InvoiceOcrProcessor(service, storageService, [
    {
      name: 'TEXTRACT',
      isAvailable: () => true,
      async extract() {
        return {
          invoiceNumber: 'OCR-100',
          totalAmountMinor: 125000,
          taxAmountMinor: 25000,
          lineItems: [],
          rawPayload: { provider: 'textract' },
        };
      },
    },
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        tesseractCalls += 1;
        return {
          invoiceNumber: 'OCR-101',
          totalAmountMinor: 100,
          taxAmountMinor: 0,
          lineItems: [],
          rawPayload: { provider: 'tesseract' },
        };
      },
    },
  ]);

  const result = await processor.process(createJob(invoice));

  assert.equal(result.provider, 'TEXTRACT');
  assert.equal(tesseractCalls, 0);
  assert.equal(harness.state.invoices[0].ocrStatus, 'COMPLETED');
});

test('processor falls back from Textract to Tesseract', async () => {
  const { harness, service, storageService } = createProcessorHarness();
  const invoice = harness.insertInvoice();
  const processor = new InvoiceOcrProcessor(service, storageService, [
    {
      name: 'TEXTRACT',
      isAvailable: () => true,
      async extract() {
        throw new Error('Textract unavailable');
      },
    },
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        return {
          invoiceNumber: 'OCR-FALLBACK',
          totalAmountMinor: 2500,
          taxAmountMinor: 500,
          lineItems: [],
          rawPayload: { provider: 'tesseract' },
        };
      },
    },
  ]);

  const result = await processor.process(createJob(invoice));

  assert.equal(result.provider, 'TESSERACT');
  assert.equal(harness.state.invoices[0].invoiceNumber, 'OCR-FALLBACK');
  assert.equal(harness.state.invoices[0].ocrProvider, 'TESSERACT');
});

test('processor normalizes OCR line items into invoice lines', async () => {
  const { harness, service, storageService } = createProcessorHarness();
  const invoice = harness.insertInvoice();
  const processor = new InvoiceOcrProcessor(service, storageService, [
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        return {
          counterpartyName: 'Mapped Counterparty',
          invoiceNumber: 'OCR-LINES',
          totalAmountMinor: 1000,
          taxAmountMinor: 100,
          lineItems: [
            {
              description: 'Line A',
              quantity: 2,
              unitPriceMinor: 450,
              amountMinor: 900,
              taxRate: 5,
            },
          ],
          rawPayload: { provider: 'tesseract', lines: 1 },
        };
      },
    },
  ]);

  await processor.process(createJob(invoice));

  assert.equal(harness.state.invoiceLines.length, 1);
  assert.equal(harness.state.invoiceLines[0].description, 'Line A');
  assert.equal(harness.state.invoices[0].counterpartyName, 'Mapped Counterparty');
});

test('processor writes reviewReason when all OCR providers fail', async () => {
  const { harness, service, storageService } = createProcessorHarness();
  const invoice = harness.insertInvoice();
  const processor = new InvoiceOcrProcessor(service, storageService, [
    {
      name: 'TEXTRACT',
      isAvailable: () => true,
      async extract() {
        throw new Error('textract boom');
      },
    },
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        throw new Error('tesseract boom');
      },
    },
  ]);

  await assert.rejects(() => processor.process(createJob(invoice)), InvoiceOcrFailedException);
  assert.equal(harness.state.invoices[0].ocrStatus, 'FAILED');
  assert.match(harness.state.invoices[0].reviewReason, /textract boom/i);
  assert.match(harness.state.invoices[0].reviewReason, /tesseract boom/i);
});

test('processor is idempotent for already completed invoices', async () => {
  const { harness, service, storageService, storageCalls } = createProcessorHarness();
  const invoice = harness.insertInvoice({
    status: 'PENDING_REVIEW',
    ocrStatus: 'COMPLETED',
  });
  let providerCalls = 0;
  const processor = new InvoiceOcrProcessor(service, storageService, [
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        providerCalls += 1;
        throw new Error('should not run');
      },
    },
  ]);

  const result = await processor.process(createJob(invoice));

  assert.equal(result.skipped, true);
  assert.equal(storageCalls.length, 0);
  assert.equal(providerCalls, 0);
});
