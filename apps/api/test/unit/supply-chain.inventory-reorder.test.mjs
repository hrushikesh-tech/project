import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSupplyChainHarness } from '../helpers/supply-chain-test-store.mjs';

const require = createRequire(import.meta.url);
const { GoodsReceiptService } = require('../../dist/src/supply-chain/receiving/goods-receipt.service.js');
const { FifoInventoryService } = require('../../dist/src/supply-chain/inventory/fifo-inventory.service.js');
const { ReorderAutomationService } = require('../../dist/src/supply-chain/reorder/reorder-automation.service.js');

test('goods receipts move purchase orders to PARTIALLY_RECEIVED and FULLY_RECEIVED', async () => {
  const harness = createSupplyChainHarness();
  const goodsReceiptService = new GoodsReceiptService(harness.prisma, harness.cls);
  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const warehouse = harness.insertWarehouse({ code: 'MAIN', name: 'Main Warehouse' });
  const vendor = harness.insertVendor({ legalEntityId: legalEntity.id, status: 'ACTIVE' });
  const product = harness.insertProduct({
    sku: 'GR-PROD-1',
    name: 'Received Product',
    reorderPoint: 2,
  });
  const purchaseOrder = harness.insertPurchaseOrder({
    legalEntityId: legalEntity.id,
    vendorId: vendor.id,
    status: 'APPROVED',
    lines: [
      {
        productId: product.id,
        description: 'Receipt line',
        quantity: 5,
        unitPrice: 1000,
      },
    ],
  });
  const purchaseOrderLineId = harness.state.purchaseOrderLines[0].id;

  const partial = await goodsReceiptService.createGoodsReceipt({
    purchaseOrderId: purchaseOrder.id,
    warehouseId: warehouse.id,
    receivedBy: 'receiver-1',
    lines: [
      {
        purchaseOrderLineId,
        quantityReceived: 2,
      },
    ],
  });

  assert.equal(partial.purchaseOrder.status, 'PARTIALLY_RECEIVED');
  assert.equal(harness.state.costLayers.length, 1);
  assert.equal(harness.state.inventoryMovements.length, 1);

  const full = await goodsReceiptService.createGoodsReceipt({
    purchaseOrderId: purchaseOrder.id,
    warehouseId: warehouse.id,
    receivedBy: 'receiver-1',
    lines: [
      {
        purchaseOrderLineId,
        quantityReceived: 3,
      },
    ],
  });

  assert.equal(full.purchaseOrder.status, 'FULLY_RECEIVED');
  assert.equal(harness.state.inventoryItems[0].quantity.toString(), '5');
});

test('fifo inventory consumption depletes oldest cost layers first and fails safely when stock is insufficient', async () => {
  const harness = createSupplyChainHarness();
  const fifoService = new FifoInventoryService(harness.prisma, harness.cls);
  const warehouse = harness.insertWarehouse({ code: 'FIFO', name: 'FIFO Warehouse' });
  const product = harness.insertProduct({
    sku: 'FIFO-PROD-1',
    name: 'FIFO Product',
    reorderPoint: 1,
  });
  harness.insertInventoryItem({
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 7,
    reservedQuantity: 0,
  });
  const oldestLayer = harness.insertCostLayer({
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 3,
    remainingQuantity: 3,
    unitCost: 100,
    receivedAt: new Date('2026-04-01T00:00:00.000Z'),
  });
  const newestLayer = harness.insertCostLayer({
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 4,
    remainingQuantity: 4,
    unitCost: 150,
    receivedAt: new Date('2026-04-02T00:00:00.000Z'),
  });

  const result = await fifoService.consumeInventory({
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 5,
    reason: 'Production issue',
  });

  assert.equal(result.remainingQuantity, '2');
  assert.equal(
    harness.state.costLayers.find((layer) => layer.id === oldestLayer.id).remainingQuantity.toString(),
    '0',
  );
  assert.equal(
    harness.state.costLayers.find((layer) => layer.id === newestLayer.id).remainingQuantity.toString(),
    '2',
  );
  assert.equal(harness.state.inventoryMovements.length, 2);

  const snapshot = harness.state.costLayers.map((layer) => layer.remainingQuantity.toString());
  await assert.rejects(
    () =>
      fifoService.consumeInventory({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 10,
        reason: 'Blocked issue',
      }),
    /insufficient/i,
  );
  assert.deepEqual(
    harness.state.costLayers.map((layer) => layer.remainingQuantity.toString()),
    snapshot,
  );
});

test('reorder automation creates draft POs, suppresses duplicates, and records skip reasons', async () => {
  const harness = createSupplyChainHarness();
  const reorderService = new ReorderAutomationService(harness.prisma);
  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const activeVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'ACTIVE',
    name: 'Reorder Vendor',
  });
  const blockedVendor = harness.insertVendor({
    legalEntityId: legalEntity.id,
    status: 'INACTIVE',
    name: 'Blocked Reorder Vendor',
  });

  const reorderProduct = harness.insertProduct({
    sku: 'REORDER-1',
    name: 'Reorder Product',
    reorderPoint: 5,
  });
  const missingConfigProduct = harness.insertProduct({
    sku: 'REORDER-2',
    name: 'Missing Config Product',
    reorderPoint: 4,
  });
  const blockedVendorProduct = harness.insertProduct({
    sku: 'REORDER-3',
    name: 'Blocked Vendor Product',
    reorderPoint: 3,
  });
  const openPoProduct = harness.insertProduct({
    sku: 'REORDER-4',
    name: 'Open PO Product',
    reorderPoint: 6,
  });

  harness.insertReplenishmentSetting({
    productId: reorderProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    reorderQuantity: 10,
  });
  harness.insertReplenishmentSetting({
    productId: blockedVendorProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: blockedVendor.id,
    reorderQuantity: 7,
  });
  harness.insertReplenishmentSetting({
    productId: openPoProduct.id,
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    reorderQuantity: 8,
  });

  harness.insertPurchaseOrder({
    legalEntityId: legalEntity.id,
    vendorId: activeVendor.id,
    status: 'DRAFT',
    lines: [
      {
        productId: openPoProduct.id,
        description: 'Existing open PO',
        quantity: 2,
        unitPrice: 0,
      },
    ],
  });

  const result = await reorderService.runForTenant('tenant-1');

  assert.equal(result.createdDrafts, 1);
  assert.equal(result.suppressedOpenPo, 1);
  assert.equal(result.skippedMissingConfig, 1);
  assert.equal(result.skippedBlockedVendor, 1);

  const createdDraft = harness.state.purchaseOrders.find(
    (po) =>
      po.status === 'DRAFT' &&
      harness.state.purchaseOrderLines.some(
        (line) => line.purchaseOrderId === po.id && line.productId === reorderProduct.id,
      ),
  );
  assert.ok(createdDraft);

  const skipReasons = harness.state.outboxEvents.map((event) => event.payload.reason);
  assert.ok(skipReasons.includes('missing_replenishment_configuration'));
  assert.ok(skipReasons.includes('blocked_vendor'));
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
        (line) =>
          line.purchaseOrderId === po.id &&
          line.productId === blockedVendorProduct.id,
      ),
    ),
    false,
  );
  assert.equal(
    harness.state.purchaseOrders.some((po) =>
      harness.state.purchaseOrderLines.some(
        (line) =>
          line.purchaseOrderId === po.id &&
          line.productId === missingConfigProduct.id,
      ),
    ),
    false,
  );
});
