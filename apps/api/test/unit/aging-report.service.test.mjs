import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAparHarness } from '../helpers/apar-test-store.mjs';

const require = createRequire(import.meta.url);
const { AgingReportService } = require('../../dist/src/ap-ar/reports/aging-report.service.js');

function createAgingFixture() {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const vendor = harness.insertVendor({ legalEntityId: entity.id, name: 'Aging Vendor' });

  return {
    harness,
    entity,
    vendor,
    service: new AgingReportService(harness.prisma),
  };
}

test('aging report places not-yet-due invoices in current bucket', async () => {
  const { harness, entity, vendor, service } = createAgingFixture();
  harness.insertInvoice({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    dueDate: new Date('2026-04-20T00:00:00.000Z'),
    totalAmount: 1000,
  });

  const report = await service.getReport({
    legalEntityId: entity.id,
    type: 'PAYABLE',
    asOfDate: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(report.summary.current, '1000');
});

test('aging report places 1..30 day balances in 30 bucket', async () => {
  const { harness, entity, vendor, service } = createAgingFixture();
  harness.insertInvoice({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    dueDate: new Date('2026-03-31T00:00:00.000Z'),
    totalAmount: 2000,
  });

  const report = await service.getReport({
    legalEntityId: entity.id,
    type: 'PAYABLE',
    asOfDate: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(report.summary.bucket30, '2000');
});

test('aging report places 31..60 day balances in 60 bucket', async () => {
  const { harness, entity, vendor, service } = createAgingFixture();
  harness.insertInvoice({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    dueDate: new Date('2026-03-01T00:00:00.000Z'),
    totalAmount: 3000,
  });

  const report = await service.getReport({
    legalEntityId: entity.id,
    type: 'PAYABLE',
    asOfDate: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(report.summary.bucket60, '3000');
});

test('aging report places balances older than 60 days in over60 bucket', async () => {
  const { harness, entity, vendor, service } = createAgingFixture();
  harness.insertInvoice({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    dueDate: new Date('2026-01-01T00:00:00.000Z'),
    totalAmount: 4000,
  });

  const report = await service.getReport({
    legalEntityId: entity.id,
    type: 'PAYABLE',
    asOfDate: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(report.summary.over60, '4000');
});
