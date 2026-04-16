import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAparHarness } from '../helpers/apar-test-store.mjs';

const require = createRequire(import.meta.url);
const { ThreeWayMatchService } = require('../../dist/src/ap-ar/matching/three-way-match.service.js');

function seedMatchFixture(overrides = {}) {
  const harness = createAparHarness();
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const vendor = harness.insertVendor({ legalEntityId: entity.id, name: 'Match Vendor' });
  const purchaseOrder = harness.insertPurchaseOrder({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    poNumber: 'PO-MATCH',
    totalAmount: 1000,
    lines: [
      {
        description: overrides.poDescription ?? 'Office Chairs',
        quantity: 2,
        unitPrice: 500,
        receivedQuantity: overrides.receivedQuantity ?? 2,
      },
    ],
  });
  const poLineId = harness.state.purchaseOrderLines[0].id;
  harness.insertGoodsReceipt({
    purchaseOrderId: purchaseOrder.id,
    legalEntityId: entity.id,
    lines: [
      {
        purchaseOrderLineId: poLineId,
        quantityReceived: overrides.goodsReceiptQuantity ?? 2,
      },
    ],
  });
  const invoice = harness.insertInvoice({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    purchaseOrderId: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    totalAmount: overrides.invoiceTotal ?? 1000,
    lines: [
      {
        description: overrides.invoiceDescription ?? 'Office Chairs',
        quantity: overrides.invoiceQuantity ?? 2,
        unitPrice: 500,
        amount: overrides.invoiceTotal ?? 1000,
      },
    ],
  });

  return { harness, invoice };
}

test('three-way match succeeds when PO, quantity, amount, and similarity thresholds pass', async () => {
  const { harness, invoice } = seedMatchFixture();
  const service = new ThreeWayMatchService(harness.prisma);

  const result = await service.matchInvoice('tenant-1', invoice.id);

  assert.equal(result.matchStatus, 'MATCHED');
  assert.equal(result.amountMatch, true);
  assert.equal(result.quantityMatch, true);
  assert.equal(result.mismatchReasons.length, 0);
});

test('three-way match flags amount variance above 1%', async () => {
  const { harness, invoice } = seedMatchFixture({ invoiceTotal: 1300 });
  const service = new ThreeWayMatchService(harness.prisma);

  const result = await service.matchInvoice('tenant-1', invoice.id);

  assert.equal(result.matchStatus, 'MISMATCHED');
  assert.equal(result.amountMatch, false);
  assert.match(result.mismatchReasons.join(' '), /1%/);
});

test('three-way match flags insufficient received quantity', async () => {
  const { harness, invoice } = seedMatchFixture({
    goodsReceiptQuantity: 1,
    invoiceQuantity: 2,
  });
  const service = new ThreeWayMatchService(harness.prisma);

  const result = await service.matchInvoice('tenant-1', invoice.id);

  assert.equal(result.matchStatus, 'MISMATCHED');
  assert.equal(result.quantityMatch, false);
  assert.match(result.mismatchReasons.join(' '), /quantities/i);
});

test('three-way match flags line similarity below 0.85', async () => {
  const { harness, invoice } = seedMatchFixture({
    invoiceDescription: 'Cloud Hosting Subscription',
  });
  const service = new ThreeWayMatchService(harness.prisma);

  const result = await service.matchInvoice('tenant-1', invoice.id);

  assert.equal(result.matchStatus, 'MISMATCHED');
  assert.match(result.mismatchReasons.join(' '), /0\.85/);
});
