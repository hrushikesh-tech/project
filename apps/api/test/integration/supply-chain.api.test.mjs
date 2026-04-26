import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSupplyChainHarness } from '../helpers/supply-chain-test-store.mjs';
import { configureApiPlatform, unwrapBody } from '../helpers/app-platform.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const { ClsService } = require('nestjs-cls');
const { SupplyChainController } = require('../../dist/src/supply-chain/supply-chain.controller.js');
const { SupplyChainService } = require('../../dist/src/supply-chain/supply-chain.service.js');
const { GoodsReceiptService } = require('../../dist/src/supply-chain/receiving/goods-receipt.service.js');
const { FifoInventoryService } = require('../../dist/src/supply-chain/inventory/fifo-inventory.service.js');
const { SupplyChainExceptionFilter } = require('../../dist/src/supply-chain/supply-chain-exception.filter.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');
const { RolesGuard } = require('../../dist/src/common/guards/roles.guard.js');

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SupplyChainController],
    providers: [
      SupplyChainService,
      GoodsReceiptService,
      FifoInventoryService,
      { provide: PrismaService, useValue: harness.prisma },
      { provide: ClsService, useValue: harness.cls },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers['x-roles'];
    req.user = {
      userId: typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : 'sc-user',
      email: 'supply-chain@amdox.dev',
      roles:
        typeof rolesHeader === 'string'
          ? rolesHeader.split(',').map((value) => value.trim()).filter(Boolean)
          : ['supply_chain_manager'],
      tenantId:
        typeof req.headers['x-auth-tenant'] === 'string' ? req.headers['x-auth-tenant'] : 'tenant-1',
    };
    next();
  });
  app.useGlobalGuards(
    new TenantGuard(harness.cls, new Reflector()),
    new RolesGuard(new Reflector()),
  );
  app.useGlobalFilters(new SupplyChainExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await configureApiPlatform(app);
  return app;
}

test('supply-chain api supports purchasing setup, po lifecycle, receiving, and fifo consumption', async () => {
  const harness = createSupplyChainHarness();
  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const vendor = unwrapBody(
    await api.post('/api/v1/supply-chain/vendors').send({
      legalEntityId: legalEntity.id,
      name: 'API Vendor',
      code: 'API-VENDOR',
      currency: 'INR',
      paymentTerms: 30,
    }),
  );
  assert.equal(vendor.status, 'ACTIVE');

  const product = unwrapBody(
    await api.post('/api/v1/supply-chain/products').send({
      sku: 'API-PROD-1',
      name: 'API Product',
      reorderPoint: 2,
    }),
  );

  const warehouse = unwrapBody(
    await api.post('/api/v1/supply-chain/warehouses').send({
      name: 'API Warehouse',
      code: 'API-WH',
    }),
  );

  const replenishment = await api
    .put(`/api/v1/supply-chain/products/${product.id}/replenishment`)
    .send({
      legalEntityId: legalEntity.id,
      vendorId: vendor.id,
      reorderQuantity: 6,
    });
  assert.equal(replenishment.status, 200);

  const purchaseOrder = unwrapBody(
    await api.post('/api/v1/supply-chain/purchase-orders').send({
      vendorId: vendor.id,
      legalEntityId: legalEntity.id,
      lines: [
        {
          productId: product.id,
          description: 'API PO line',
          quantity: 5,
          unitPrice: 1000,
        },
      ],
    }),
  );
  assert.equal(purchaseOrder.status, 'DRAFT');

  const submitted = await api.post(`/api/v1/supply-chain/purchase-orders/${purchaseOrder.id}/submit`);
  assert.equal(submitted.status, 201);
  assert.equal(unwrapBody(submitted).status, 'SUBMITTED');

  const approved = await api.post(`/api/v1/supply-chain/purchase-orders/${purchaseOrder.id}/approve`);
  assert.equal(approved.status, 201);
  assert.equal(unwrapBody(approved).status, 'APPROVED');

  const sent = await api.post(`/api/v1/supply-chain/purchase-orders/${purchaseOrder.id}/send`);
  assert.equal(sent.status, 201);
  assert.equal(unwrapBody(sent).status, 'SENT_TO_VENDOR');

  const purchaseOrderLineId = harness.state.purchaseOrderLines.find(
    (line) => line.purchaseOrderId === purchaseOrder.id,
  ).id;
  const receipt = await api.post('/api/v1/supply-chain/goods-receipts').send({
    purchaseOrderId: purchaseOrder.id,
    warehouseId: warehouse.id,
    receivedBy: 'api-receiver',
    lines: [
      {
        purchaseOrderLineId,
        quantityReceived: 5,
      },
    ],
  });
  assert.equal(receipt.status, 201);
  assert.equal(unwrapBody(receipt).purchaseOrder.status, 'FULLY_RECEIVED');

  const consume = await api.post('/api/v1/supply-chain/inventory/consume').send({
    productId: product.id,
    warehouseId: warehouse.id,
    quantity: 2,
    reason: 'API stock issue',
  });
  assert.equal(consume.status, 201);
  assert.equal(unwrapBody(consume).remainingQuantity, '3');

  const purchaseOrders = await api
    .get('/api/v1/supply-chain/purchase-orders')
    .set('x-roles', 'viewer');
  assert.equal(purchaseOrders.status, 200);
  assert.equal(unwrapBody(purchaseOrders).length, 1);

  const crossTenant = await api
    .get('/api/v1/supply-chain/purchase-orders')
    .set('x-roles', 'viewer')
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2');
  assert.equal(crossTenant.status, 403);

  await app.close();
});
