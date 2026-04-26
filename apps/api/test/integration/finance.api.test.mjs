import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createFinanceHarness } from '../helpers/finance-test-store.mjs';
import { configureApiPlatform, unwrapBody } from '../helpers/app-platform.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { ClsModule, ClsService } = require('nestjs-cls');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const { PrismaModule } = require('../../dist/src/prisma/prisma.module.js');
const { FinanceModule } = require('../../dist/src/finance/finance.module.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');
const { RolesGuard } = require('../../dist/src/common/guards/roles.guard.js');

async function createApp(harness) {
  const moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ClsModule.forRoot({ global: true }),
      PrismaModule,
      FinanceModule,
    ],
  });

  moduleBuilder.overrideProvider(PrismaService).useValue(harness.prisma);
  moduleBuilder.overrideProvider(ClsService).useValue(harness.cls);
  moduleBuilder.overrideProvider(ConfigService).useValue(harness.configService);

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
          : ['tenant_admin'],
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
  return app;
}

test('finance API can create resources, post journals, and return reports', async () => {
  const harness = createFinanceHarness();
  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const entity = unwrapBody(
    await api.post('/api/v1/finance/entities').send({
      code: 'IND',
      name: 'India Operations',
      baseCurrency: 'INR',
    }),
  );

  const cash = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: entity.id,
      code: '1000',
      name: 'Cash',
      type: 'ASSET',
      currency: 'INR',
    }),
  );
  const capital = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: entity.id,
      code: '3000',
      name: 'Capital',
      type: 'EQUITY',
      currency: 'INR',
    }),
  );
  const revenue = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: entity.id,
      code: '4000',
      name: 'Revenue',
      type: 'REVENUE',
      currency: 'INR',
    }),
  );
  const expense = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: entity.id,
      code: '5000',
      name: 'Expense',
      type: 'EXPENSE',
      currency: 'INR',
    }),
  );

  const period = unwrapBody(
    await api.post('/api/v1/finance/periods').send({
      legalEntityId: entity.id,
      name: 'FY-2026',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    }),
  );

  const seedCapital = unwrapBody(
    await api.post('/api/v1/finance/journal-entries').send({
      legalEntityId: entity.id,
      periodId: period.id,
      date: '2026-04-01T00:00:00.000Z',
      description: 'Capital injection',
      lines: [
        { accountId: cash.id, debitAmountMinor: 5000, currency: 'INR' },
        { accountId: capital.id, creditAmountMinor: 5000, currency: 'INR' },
      ],
    }),
  );
  await api.post(`/api/v1/finance/journal-entries/${seedCapital.id}/post`).send({});

  const sale = unwrapBody(
    await api.post('/api/v1/finance/journal-entries').send({
      legalEntityId: entity.id,
      periodId: period.id,
      date: '2026-04-02T00:00:00.000Z',
      description: 'Product sale',
      lines: [
        { accountId: cash.id, debitAmountMinor: 2000, currency: 'INR' },
        { accountId: revenue.id, creditAmountMinor: 2000, currency: 'INR' },
      ],
    }),
  );
  await api.post(`/api/v1/finance/journal-entries/${sale.id}/post`).send({});

  const cost = unwrapBody(
    await api.post('/api/v1/finance/journal-entries').send({
      legalEntityId: entity.id,
      periodId: period.id,
      date: '2026-04-03T00:00:00.000Z',
      description: 'Operating cost',
      lines: [
        { accountId: expense.id, debitAmountMinor: 500, currency: 'INR' },
        { accountId: cash.id, creditAmountMinor: 500, currency: 'INR' },
      ],
    }),
  );
  await api.post(`/api/v1/finance/journal-entries/${cost.id}/post`).send({});

  const accountsResponse = await api.get('/api/v1/finance/accounts').query({
    legalEntityId: entity.id,
  });
  assert.equal(accountsResponse.status, 200);
  assert.equal(unwrapBody(accountsResponse).length, 4);

  const trialBalance = await api.get('/api/v1/finance/reports/trial-balance').query({
    legalEntityId: entity.id,
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(trialBalance.status, 200);
  assert.equal(unwrapBody(trialBalance).totalDebitMinor, '7500');
  assert.equal(unwrapBody(trialBalance).totalCreditMinor, '7500');

  const incomeStatement = await api.get('/api/v1/finance/reports/income-statement').query({
    legalEntityId: entity.id,
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(incomeStatement.status, 200);
  assert.equal(unwrapBody(incomeStatement).totalRevenueMinor, '2000');
  assert.equal(unwrapBody(incomeStatement).totalExpenseMinor, '500');
  assert.equal(unwrapBody(incomeStatement).netIncomeMinor, '1500');

  const balanceSheet = await api.get('/api/v1/finance/reports/balance-sheet').query({
    legalEntityId: entity.id,
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(balanceSheet.status, 200);
  assert.equal(unwrapBody(balanceSheet).totalAssetsMinor, '6500');
  assert.equal(unwrapBody(balanceSheet).totalEquityMinor, '5000');

  const crossTenant = await api
    .get('/api/v1/finance/accounts')
    .query({ legalEntityId: entity.id })
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2');
  assert.equal(crossTenant.status, 403);

  await app.close();
});

test('finance API blocks closed-period posting, serves FX, and creates intercompany transfers', async () => {
  const harness = createFinanceHarness();
  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const sourceEntity = unwrapBody(
    await api.post('/api/v1/finance/entities').send({
      code: 'SRC',
      name: 'Source Entity',
      baseCurrency: 'INR',
    }),
  );
  const destinationEntity = unwrapBody(
    await api.post('/api/v1/finance/entities').send({
      code: 'DST',
      name: 'Destination Entity',
      baseCurrency: 'INR',
    }),
  );

  const sourceCash = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: sourceEntity.id,
      code: '1000',
      name: 'Source Cash',
      type: 'ASSET',
      currency: 'INR',
    }),
  );
  const sourceClearing = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: sourceEntity.id,
      code: '1200',
      name: 'Due From Affiliate',
      type: 'ASSET',
      currency: 'INR',
    }),
  );
  const destinationCash = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: destinationEntity.id,
      code: '1000',
      name: 'Destination Cash',
      type: 'ASSET',
      currency: 'INR',
    }),
  );
  const destinationClearing = unwrapBody(
    await api.post('/api/v1/finance/accounts').send({
      legalEntityId: destinationEntity.id,
      code: '2200',
      name: 'Due To Affiliate',
      type: 'LIABILITY',
      currency: 'INR',
    }),
  );

  const closedPeriod = unwrapBody(
    await api.post('/api/v1/finance/periods').send({
      legalEntityId: sourceEntity.id,
      name: 'APR-CLOSED',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-30T00:00:00.000Z',
    }),
  );
  await api.post(`/api/v1/finance/periods/${closedPeriod.id}/close`).send({});

  const openSourcePeriod = unwrapBody(
    await api.post('/api/v1/finance/periods').send({
      legalEntityId: sourceEntity.id,
      name: 'APR-OPEN',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-30T00:00:00.000Z',
    }),
  );
  const openDestinationPeriod = unwrapBody(
    await api.post('/api/v1/finance/periods').send({
      legalEntityId: destinationEntity.id,
      name: 'APR-DEST',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-30T00:00:00.000Z',
    }),
  );

  const draft = unwrapBody(
    await api.post('/api/v1/finance/journal-entries').send({
      legalEntityId: sourceEntity.id,
      periodId: closedPeriod.id,
      date: '2026-04-10T00:00:00.000Z',
      description: 'Closed period attempt',
      lines: [
        { accountId: sourceCash.id, debitAmountMinor: 1000, currency: 'INR' },
        { accountId: sourceClearing.id, creditAmountMinor: 1000, currency: 'INR' },
      ],
    }),
  );
  const closedPosting = await api.post(`/api/v1/finance/journal-entries/${draft.id}/post`).send({});
  assert.equal(closedPosting.status, 409);

  harness.insertFxRate({
    tenantId: 'tenant-1',
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: new Date('2026-04-05T00:00:00.000Z'),
    rate: new (require('@amdox/db').Prisma.Decimal)('82.5'),
  });
  const fxResponse = await api.get('/api/v1/finance/fx-rates').query({
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: '2026-04-05T00:00:00.000Z',
  });
  assert.equal(fxResponse.status, 200);
  assert.equal(unwrapBody(fxResponse).rate, '82.5');

  const transfer = await api.post('/api/v1/finance/intercompany-transfers').send({
    sourceLegalEntityId: sourceEntity.id,
    destinationLegalEntityId: destinationEntity.id,
    sourcePeriodId: openSourcePeriod.id,
    destinationPeriodId: openDestinationPeriod.id,
    sourceClearingAccountId: sourceClearing.id,
    destinationClearingAccountId: destinationClearing.id,
    transactionDate: '2026-04-15T00:00:00.000Z',
    currency: 'INR',
    description: 'Intercompany funding',
    lines: [
      {
        sourceAccountId: sourceCash.id,
        destinationAccountId: destinationCash.id,
        amountMinor: 2500,
        description: 'Working capital move',
      },
    ],
  });

  assert.equal(transfer.status, 201);
  assert.equal(unwrapBody(transfer).totalAmount, '2500');
  assert.equal(harness.state.intercompanyTransfers.length, 1);
  assert.equal(harness.state.journalEntries.length >= 3, true);

  await app.close();
});
