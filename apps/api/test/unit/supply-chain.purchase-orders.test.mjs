import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSupplyChainHarness } from '../helpers/supply-chain-test-store.mjs';

const require = createRequire(import.meta.url);
const { SupplyChainService } = require('../../dist/src/supply-chain/supply-chain.service.js');

function createService() {
  const harness = createSupplyChainHarness();
  const service = new SupplyChainService(harness.prisma, harness.cls);
  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const product = harness.insertProduct({
    sku: 'PO-PROD-1',
    name: 'Purchase Order Product',
    reorderPoint: 5,
  });
  const vendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'ACTIVE',
    name: 'Preferred Vendor',
  });

  return { harness, service, legalEntity, product, vendor };
}

test('purchase orders are created in DRAFT and can follow the explicit lifecycle', async () => {
  const { service, legalEntity, product, vendor } = createService();

  const created = await service.createPurchaseOrder({
    vendorId: vendor.id,
    legalEntityId: legalEntity.id,
    currency: 'INR',
    lines: [
      {
        productId: product.id,
        description: 'Initial stock',
        quantity: 4,
        unitPrice: 1200,
      },
    ],
  });

  assert.equal(created.status, 'DRAFT');

  const submitted = await service.submitPurchaseOrder(created.id, 'buyer-1');
  assert.equal(submitted.status, 'SUBMITTED');

  const approved = await service.approvePurchaseOrder(created.id, 'manager-1');
  assert.equal(approved.status, 'APPROVED');

  const sent = await service.sendPurchaseOrderToVendor(created.id, 'manager-1');
  assert.equal(sent.status, 'SENT_TO_VENDOR');
});

test('purchase orders support the REJECTED to DRAFT loop and block non-draft edits', async () => {
  const { service, legalEntity, product, vendor } = createService();

  const created = await service.createPurchaseOrder({
    vendorId: vendor.id,
    legalEntityId: legalEntity.id,
    lines: [
      {
        productId: product.id,
        description: 'Editable line',
        quantity: 2,
        unitPrice: 900,
      },
    ],
  });

  await service.submitPurchaseOrder(created.id, 'buyer-1');
  const rejected = await service.rejectPurchaseOrder(
    created.id,
    'Pricing review required',
    'manager-1',
  );
  assert.equal(rejected.status, 'REJECTED');

  const draftAgain = await service.returnRejectedPurchaseOrderToDraft(created.id);
  assert.equal(draftAgain.status, 'DRAFT');

  await service.submitPurchaseOrder(created.id, 'buyer-1');
  await assert.rejects(
    () =>
      service.replacePurchaseOrderLines(created.id, [
        {
          productId: product.id,
          description: 'Blocked edit',
          quantity: 3,
          unitPrice: 900,
        },
      ]),
    /draft/i,
  );
});

test('new purchasing is blocked for INACTIVE and BLACKLISTED vendors', async () => {
  const harness = createSupplyChainHarness();
  const service = new SupplyChainService(harness.prisma, harness.cls);
  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const product = harness.insertProduct({
    sku: 'PO-PROD-2',
    name: 'Blocked Vendor Product',
    reorderPoint: 3,
  });

  const inactiveVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'INACTIVE',
    name: 'Inactive Vendor',
  });
  const blacklistedVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'BLACKLISTED',
    name: 'Blacklisted Vendor',
  });

  await assert.rejects(
    () =>
      service.createPurchaseOrder({
        vendorId: inactiveVendor.id,
        legalEntityId: legalEntity.id,
        lines: [
          {
            productId: product.id,
            description: 'Blocked inactive vendor',
            quantity: 1,
            unitPrice: 500,
          },
        ],
      }),
    /blocked/i,
  );

  await assert.rejects(
    () =>
      service.createPurchaseOrder({
        vendorId: blacklistedVendor.id,
        legalEntityId: legalEntity.id,
        lines: [
          {
            productId: product.id,
            description: 'Blocked blacklisted vendor',
            quantity: 1,
            unitPrice: 500,
          },
        ],
      }),
    /blocked/i,
  );
});
