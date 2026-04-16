import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PayloadTooLargeException } from '@nestjs/common';
import { UnsupportedInvoiceFileException } from '@amdox/types';
import { createAparHarness } from '../helpers/apar-test-store.mjs';

const require = createRequire(import.meta.url);
const { ApArService } = require('../../dist/src/ap-ar/ap-ar.service.js');
const { OcrMapperService } = require('../../dist/src/ap-ar/ocr/ocr-mapper.service.js');

function createUploadService(harness, overrides = {}) {
  const storageCalls = [];
  const queueCalls = [];
  const storageService = overrides.storageService ?? {
    async uploadInvoiceSource(payload) {
      storageCalls.push(payload);
      return { bucket: 'test-bucket', key: `invoices/${payload.tenantId}/${payload.invoiceId}/source.pdf` };
    },
  };
  const queue = overrides.queue ?? {
    async add(name, payload, options) {
      queueCalls.push({ name, payload, options });
      return { id: payload.invoiceId };
    },
  };

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
    service,
    storageCalls,
    queueCalls,
  };
}

function createPdfFile(overrides = {}) {
  const buffer =
    overrides.buffer ??
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF');
  return {
    originalname: overrides.originalname ?? 'invoice.pdf',
    mimetype: overrides.mimetype ?? 'application/pdf',
    size: overrides.size ?? buffer.length,
    buffer,
  };
}

test('upload accepts supported invoice file types', async () => {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const vendor = harness.insertVendor({ legalEntityId: entity.id, name: 'Acme Supplies' });
  const { service } = createUploadService(harness);

  const result = await service.uploadInvoice(
    {
      legalEntityId: entity.id,
      type: 'PAYABLE',
      vendorId: vendor.id,
    },
    createPdfFile(),
  );

  assert.equal(result.status, 'OCR_PENDING');
  assert.equal(result.ocrStatus, 'QUEUED');
});

test('upload rejects unsupported invoice file types', async () => {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const { service } = createUploadService(harness);

  await assert.rejects(
    () =>
      service.uploadInvoice(
        {
          legalEntityId: entity.id,
          type: 'PAYABLE',
        },
        {
          originalname: 'invoice.txt',
          mimetype: 'text/plain',
          size: 4,
          buffer: Buffer.from('oops'),
        },
      ),
    UnsupportedInvoiceFileException,
  );
});

test('upload rejects oversized invoice files', async () => {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const { service } = createUploadService(harness);

  await assert.rejects(
    () =>
      service.uploadInvoice(
        {
          legalEntityId: entity.id,
          type: 'PAYABLE',
        },
        createPdfFile({ size: 10 * 1024 * 1024 + 1 }),
      ),
    PayloadTooLargeException,
  );
});

test('upload creates a queued draft invoice with source document metadata', async () => {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const vendor = harness.insertVendor({ legalEntityId: entity.id, name: 'Northwind Vendor' });
  const { service, storageCalls } = createUploadService(harness);

  const result = await service.uploadInvoice(
    {
      legalEntityId: entity.id,
      type: 'PAYABLE',
      vendorId: vendor.id,
      poNumber: 'PO-100',
    },
    createPdfFile(),
  );

  assert.equal(harness.state.invoices.length, 1);
  assert.equal(harness.state.invoices[0].counterpartyName, 'Northwind Vendor');
  assert.equal(harness.state.invoices[0].sourceDocumentMimeType, 'application/pdf');
  assert.match(harness.state.invoices[0].sourceDocumentKey, /^invoices\/tenant-1\//);
  assert.equal(storageCalls.length, 1);
  assert.equal(result.invoiceId, harness.state.invoices[0].id);
});

test('upload dispatches an OCR queue job after draft creation', async () => {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const vendor = harness.insertVendor({ legalEntityId: entity.id, name: 'Queue Vendor' });
  const { service, queueCalls } = createUploadService(harness);

  await service.uploadInvoice(
    {
      legalEntityId: entity.id,
      type: 'PAYABLE',
      vendorId: vendor.id,
    },
    createPdfFile(),
  );

  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].name, 'process-invoice-ocr');
  assert.equal(queueCalls[0].payload.invoiceId, harness.state.invoices[0].id);
});
