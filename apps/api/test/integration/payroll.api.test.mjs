import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const { ClsService } = require('nestjs-cls');
const { PayrollController } = require('../../dist/src/payroll/payroll.controller.js');
const { PayrollService } = require('../../dist/src/payroll/payroll.service.js');
const { PayrollQueue } = require('../../dist/src/payroll/queue/payroll.queue.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');
const { RolesGuard } = require('../../dist/src/common/guards/roles.guard.js');

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [PayrollController],
    providers: [
      PayrollService,
      { provide: PayrollQueue, useValue: { enqueueRun: async () => ({ id: 'job-1' }) } },
      { provide: PrismaService, useValue: harness.prisma },
      { provide: ClsService, useValue: harness.cls },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers['x-roles'];
    req.user = {
      userId: typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : 'hr-user',
      email: 'payroll@amdox.dev',
      roles:
        typeof rolesHeader === 'string'
          ? rolesHeader.split(',').map((value) => value.trim()).filter(Boolean)
          : ['hr_manager'],
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
  await app.init();
  return app;
}

test('payroll api manages salary structures and payroll runs with tenant-safe duplicate protection', async () => {
  const harness = createPayrollHarness();
  const legalEntity = harness.insertLegalEntity({ code: 'IND01' });
  harness.insertFiscalPeriod({
    legalEntityId: legalEntity.id,
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2026-04-30T23:59:59.999Z'),
  });
  const department = harness.insertDepartment({ code: 'OPS', name: 'Operations' });
  const employee = harness.insertEmployee({
    departmentId: department.id,
    employeeCode: 'EMP-001',
  });

  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const salaryBody = {
    legalEntityId: legalEntity.id,
    taxRegime: 'NEW',
    effectiveFrom: '2026-04-01T00:00:00.000Z',
    components: [
      {
        code: 'BASIC',
        name: 'Basic',
        componentType: 'EARNING',
        amountMinor: 6000000,
        pfApplicable: true,
      },
      {
        code: 'HRA',
        name: 'HRA',
        componentType: 'EARNING',
        amountMinor: 2000000,
      },
    ],
  };

  const upserted = await api
    .put(`/api/v1/payroll/salary-structures/${employee.id}`)
    .send(salaryBody);
  assert.equal(upserted.status, 200);

  const salaryStructure = await api
    .get(`/api/v1/payroll/salary-structures/${employee.id}`)
    .set('x-roles', 'finance_manager');
  assert.equal(salaryStructure.status, 200);
  assert.equal(salaryStructure.body.taxRegime, 'NEW');

  const createdRun = await api.post('/api/v1/payroll/runs').send({
    legalEntityId: legalEntity.id,
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T23:59:59.999Z',
  });
  assert.equal(createdRun.status, 201);

  const runs = await api
    .get('/api/v1/payroll/runs')
    .set('x-roles', 'finance_manager');
  assert.equal(runs.status, 200);
  assert.equal(runs.body.length, 1);

  const runDetails = await api
    .get(`/api/v1/payroll/runs/${createdRun.body.id}`)
    .set('x-roles', 'finance_manager');
  assert.equal(runDetails.status, 200);

  const results = await api
    .get(`/api/v1/payroll/runs/${createdRun.body.id}/results`)
    .set('x-roles', 'finance_manager');
  assert.equal(results.status, 200);
  assert.equal(results.body.length, 1);

  const duplicateRun = await api.post('/api/v1/payroll/runs').send({
    legalEntityId: legalEntity.id,
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T23:59:59.999Z',
  });
  assert.equal(duplicateRun.status, 400);

  const forbidden = await api
    .get('/api/v1/payroll/runs')
    .set('x-roles', 'finance_manager')
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2');
  assert.equal(forbidden.status, 403);

  await app.close();
});
