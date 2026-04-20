import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSupplyChainHarness } from '../helpers/supply-chain-test-store.mjs';

const require = createRequire(import.meta.url);
const { ReorderAutomationService } = require('../../dist/src/supply-chain/reorder/reorder-automation.service.js');
const { SupplyChainProcessor } = require('../../dist/src/supply-chain/queue/supply-chain.processor.js');
const { AUTO_REORDER_JOB } = require('../../dist/src/supply-chain/queue/supply-chain.queue.js');

test('reorder worker creates drafts, suppresses open POs, and persists durable skip reasons', async () => {
  const harness = createSupplyChainHarness();
  const reorderService = new ReorderAutomationService(harness.prisma);
  const processor = new SupplyChainProcessor(harness.prisma, reorderService);

  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const activeVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'ACTIVE',
    name: 'Worker Active Vendor',
  });
  const blockedVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'BLACKLISTED',
    name: 'Worker Blocked Vendor',
  });

  const createdProduct = harness.insertProduct({
    sku: 'JOB-PROD-1',
    name: 'Job Draft Product',
    reorderPoint: 6,
  });
  const openPoProduct = harness.insertProduct({
    sku: 'JOB-PROD-2',
    name: 'Job Suppressed Product',
    reorderPoint: 4,
  });
  const missingConfigProduct = harness.insertProduct({
    sku: 'JOB-PROD-3',
    name: 'Job Missing Config Product',
    reorderPoint: 3,
  });
  const blockedVendorProduct = harness.insertProduct({
    sku: 'JOB-PROD-4',
    name: 'Job Blocked Vendor Product',
    reorderPoint: 2,
  });

  harness.insertReplenishmentSetting({
    productId: createdProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    reorderQuantity: 9,
  });
  harness.insertReplenishmentSetting({
    productId: openPoProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    reorderQuantity: 5,
  });
  harness.insertReplenishmentSetting({
    productId: blockedVendorProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: blockedVendor.id,
    reorderQuantity: 4,
  });
  harness.insertPurchaseOrder({
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    status: 'APPROVED',
    lines: [
      {
        productId: openPoProduct.id,
        description: 'Existing open PO',
        quantity: 1,
        unitPrice: 0,
      },
    ],
  });

  const result = await processor.process({
    name: AUTO_REORDER_JOB,
    data: { tenantId: 'tenant-1' },
  });

  assert.equal(result.createdDrafts, 1);
  assert.equal(result.suppressedOpenPo, 1);
  assert.equal(result.skippedMissingConfig, 1);
  assert.equal(result.skippedBlockedVendor, 1);

  const createdDraft = harness.state.purchaseOrders.find((po) =>
    harness.state.purchaseOrderLines.some(
      (line) => line.purchaseOrderId === po.id && line.productId === createdProduct.id,
    ),
  );
  assert.ok(createdDraft);
  assert.equal(createdDraft.status, 'DRAFT');

  const skipEvents = harness.state.outboxEvents.filter(
    (event) => event.eventType === 'supply-chain.reorder.skipped',
  );
  assert.ok(skipEvents.some((event) => event.payload.reason === 'missing_replenishment_configuration'));
  assert.ok(skipEvents.some((event) => event.payload.reason === 'blocked_vendor'));

  assert.equal(
    harness.state.purchaseOrders.filter((po) =>
      harness.state.purchaseOrderLines.some(
        (line) => line.purchaseOrderId === po.id && line.productId === openPoProduct.id,
      ),
    ).length,
    1,
  );
  assert.equal(
    harness.state.purchaseOrders.some((po) =>
      harness.state.purchaseOrderLines.some(
        (line) => line.purchaseOrderId === po.id && line.productId === missingConfigProduct.id,
      ),
    ),
    false,
  );
  assert.equal(
    harness.state.purchaseOrders.some((po) =>
      harness.state.purchaseOrderLines.some(
        (line) => line.purchaseOrderId === po.id && line.productId === blockedVendorProduct.id,
      ),
    ),
    false,
  );
});
