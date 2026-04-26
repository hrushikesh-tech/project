import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAparHarness } from '../helpers/apar-test-store.mjs';
import { configureApiPlatform, unwrapBody } from '../helpers/app-platform.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { ClsModule, ClsService } = require('nestjs-cls');
const { getQueueToken } = require('@nestjs/bullmq');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const { PrismaModule } = require('../../dist/src/prisma/prisma.module.js');
const { FinanceModule } = require('../../dist/src/finance/finance.module.js');
const { ApArController } = require('../../dist/src/ap-ar/ap-ar.controller.js');
const { ApArService } = require('../../dist/src/ap-ar/ap-ar.service.js');
const { OcrMapperService } = require('../../dist/src/ap-ar/ocr/ocr-mapper.service.js');
const { ThreeWayMatchService } = require('../../dist/src/ap-ar/matching/three-way-match.service.js');
const {
  InvoiceLedgerPostingService,
} = require('../../dist/src/ap-ar/posting/invoice-ledger-posting.service.js');
const { AgingReportService } = require('../../dist/src/ap-ar/reports/aging-report.service.js');
const { InvoiceStorageService } = require('../../dist/src/ap-ar/storage/invoice-storage.service.js');
const { InvoiceOcrProcessor } = require('../../dist/src/ap-ar/queue/invoice-ocr.processor.js');
const { OCR_PROVIDERS } = require('../../dist/src/ap-ar/ocr/ocr.provider.js');
const { INVOICE_OCR_QUEUE } = require('../../dist/src/ap-ar/queue/invoice-ocr.queue.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');
const { RolesGuard } = require('../../dist/src/common/guards/roles.guard.js');

async function createApp(harness) {
  const queueJobs = [];
  const fileStore = new Map();
  let extractionCall = 0;

  const storageService = {
    async uploadInvoiceSource({ tenantId, invoiceId, extension, body }) {
      const key = `invoices/${tenantId}/${invoiceId}/source.${extension}`;
      fileStore.set(key, body);
      return { bucket: 'test-bucket', key };
    },
    async getInvoiceSourceBuffer(key) {
      return fileStore.get(key);
    },
  };

  const ocrProviders = [
    {
      name: 'TEXTRACT',
      isAvailable: () => false,
      async extract() {
        throw new Error('textract disabled in test');
      },
    },
    {
      name: 'TESSERACT',
      isAvailable: () => true,
      async extract() {
        extractionCall += 1;
        if (extractionCall === 1) {
          return {
            counterpartyName: 'Match Vendor',
            invoiceNumber: 'OCR-MATCH',
            issueDate: '2026-04-10T00:00:00.000Z',
            dueDate: '2026-04-20T00:00:00.000Z',
            poNumber: 'PO-API',
            totalAmountMinor: 1000,
            taxAmountMinor: 0,
            lineItems: [
              {
                description: 'Office Chairs',
                quantity: 2,
                unitPriceMinor: 500,
                amountMinor: 1000,
                taxRate: 0,
              },
            ],
            rawPayload: { provider: 'tesseract', kind: 'matched' },
          };
        }

        return {
          counterpartyName: 'Match Vendor',
          invoiceNumber: 'OCR-MISMATCH',
          issueDate: '2026-03-01T00:00:00.000Z',
          dueDate: '2026-03-10T00:00:00.000Z',
          poNumber: 'PO-API',
          totalAmountMinor: 1300,
          taxAmountMinor: 0,
          lineItems: [
            {
              description: 'Office Chairs',
              quantity: 2,
              unitPriceMinor: 650,
              amountMinor: 1300,
              taxRate: 0,
            },
          ],
          rawPayload: { provider: 'tesseract', kind: 'mismatched' },
        };
      },
    },
  ];

  const queue = {
    async add(name, payload, options) {
      queueJobs.push({ name, payload, options });
      return { id: payload.invoiceId };
    },
  };

  const configService = {
    get(key, fallback) {
      const values = {
        REDIS_URL: 'redis://localhost:6379',
        AWS_REGION: 'us-east-1',
        AWS_S3_BUCKET: 'test-bucket',
        AWS_ACCESS_KEY_ID: 'testing',
        AWS_SECRET_ACCESS_KEY: 'testing',
        OPENEXCHANGE_APP_ID: 'test-openexchange-key',
        OPENEXCHANGE_BASE_CURRENCIES: 'USD',
        OPENEXCHANGE_TARGET_CURRENCIES: 'INR,USD,EUR',
      };
      return values[key] ?? fallback;
    },
  };

  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ClsModule.forRoot({ global: true }),
      PrismaModule,
      FinanceModule,
    ],
    controllers: [ApArController],
    providers: [
      ApArService,
      OcrMapperService,
      ThreeWayMatchService,
      InvoiceLedgerPostingService,
      AgingReportService,
      {
        provide: OCR_PROVIDERS,
        useValue: ocrProviders,
      },
      {
        provide: InvoiceStorageService,
        useValue: storageService,
      },
      {
        provide: getQueueToken(INVOICE_OCR_QUEUE),
        useValue: queue,
      },
    ],
  });

  moduleBuilder.overrideProvider(PrismaService).useValue(harness.prisma);
  moduleBuilder.overrideProvider(ClsService).useValue(harness.cls);
  moduleBuilder.overrideProvider(ConfigService).useValue(configService);
  const moduleRef = await moduleBuilder.compile();
  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers['x-roles'];
    req.user = {
      userId: typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : 'finance-user',
      email: 'finance@amdox.dev',
      roles:
        typeof rolesHeader === 'string'
          ? rolesHeader.split(',').map((value) => value.trim()).filter(Boolean)
          : ['finance_manager'],
      tenantId:
        typeof req.headers['x-auth-tenant'] === 'string' ? req.headers['x-auth-tenant'] : 'tenant-1',
    };
    next();
  });
  app.useGlobalGuards(
    new TenantGuard(harness.cls, new Reflector()),
    new RolesGuard(new Reflector()),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await configureApiPlatform(app);

  const processor = new InvoiceOcrProcessor(moduleRef.get(ApArService), storageService, ocrProviders);

  return { app, processor, queueJobs };
}

test('AP/AR API uploads invoices, processes OCR, posts matched AP, emits mismatch notifications, and returns aging', async () => {
  const harness = createAparHarness();
  const financeUser = harness.insertUser({ role: 'finance_manager', email: 'finance.manager@amdox.dev' });
  const entity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const payablesAccount = harness.insertAccount({
    legalEntityId: entity.id,
    code: '2000',
    name: 'Accounts Payable',
    type: 'LIABILITY',
    currency: 'INR',
  });
  harness.insertAccount({
    legalEntityId: entity.id,
    code: '5000',
    name: 'Office Expense',
    type: 'EXPENSE',
    currency: 'INR',
  });
  harness.insertPeriod({
    legalEntityId: entity.id,
    name: 'FY-2026',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
  });
  const vendor = harness.insertVendor({
    legalEntityId: entity.id,
    name: 'Match Vendor',
    payablesAccountId: payablesAccount.id,
  });
  const purchaseOrder = harness.insertPurchaseOrder({
    legalEntityId: entity.id,
    vendorId: vendor.id,
    poNumber: 'PO-API',
    totalAmount: 1000,
    lines: [
      {
        description: 'Office Chairs',
        quantity: 2,
        unitPrice: 500,
        receivedQuantity: 2,
      },
    ],
  });
  harness.insertGoodsReceipt({
    legalEntityId: entity.id,
    purchaseOrderId: purchaseOrder.id,
    lines: [
      {
        purchaseOrderLineId: harness.state.purchaseOrderLines[0].id,
        quantityReceived: 2,
      },
    ],
  });

  const { app, processor, queueJobs } = await createApp(harness);
  const api = request(app.getHttpServer());
  const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');

  const matchedUpload = await api
    .post('/api/v1/ap-ar/invoices/upload')
    .field('legalEntityId', entity.id)
    .field('type', 'PAYABLE')
    .field('vendorId', vendor.id)
    .field('purchaseOrderId', purchaseOrder.id)
    .field('poNumber', 'PO-API')
    .attach('file', pdfBuffer, { filename: 'matched.pdf', contentType: 'application/pdf' });

  const mismatchedUpload = await api
    .post('/api/v1/ap-ar/invoices/upload')
    .field('legalEntityId', entity.id)
    .field('type', 'PAYABLE')
    .field('vendorId', vendor.id)
    .field('purchaseOrderId', purchaseOrder.id)
    .field('poNumber', 'PO-API')
    .attach('file', pdfBuffer, { filename: 'mismatch.pdf', contentType: 'application/pdf' });

  assert.equal(matchedUpload.status, 201);
  assert.equal(mismatchedUpload.status, 201);
  assert.equal(queueJobs.length, 2);

  const matchedUploadBody = unwrapBody(matchedUpload);
  const mismatchedUploadBody = unwrapBody(mismatchedUpload);

  await processor.process({ data: queueJobs[0].payload });
  await processor.process({ data: queueJobs[1].payload });

  const matchedInvoice = harness.state.invoices.find(
    (item) => item.id === matchedUploadBody.invoiceId,
  );
  const mismatchedInvoice = harness.state.invoices.find(
    (item) => item.id === mismatchedUploadBody.invoiceId,
  );

  assert.equal(matchedInvoice.status, 'POSTED');
  assert.equal(Boolean(matchedInvoice.postedJournalEntryId), true);
  assert.equal(harness.state.invoiceLines.filter((item) => item.invoiceId === matchedInvoice.id).length, 1);

  assert.equal(mismatchedInvoice.status, 'PENDING_REVIEW');
  assert.equal(harness.state.outboxEvents.length, 1);
  assert.equal(harness.state.outboxEvents[0].eventType, 'invoice.match_failed');
  assert.equal(harness.state.notifications.length, 1);
  assert.equal(harness.state.notifications[0].userId, financeUser.id);

  const agingReport = await api.get('/api/v1/ap-ar/reports/aging').query({
    legalEntityId: entity.id,
    type: 'PAYABLE',
    asOfDate: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(agingReport.status, 200);
  assert.equal(unwrapBody(agingReport).summary.current, '1000');
  assert.equal(unwrapBody(agingReport).summary.bucket60, '1300');

  const crossTenant = await api
    .get('/api/v1/ap-ar/reports/aging')
    .query({
      legalEntityId: entity.id,
      type: 'PAYABLE',
      asOfDate: '2026-04-15T00:00:00.000Z',
    })
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2');
  assert.equal(crossTenant.status, 403);

  await app.close();
});
