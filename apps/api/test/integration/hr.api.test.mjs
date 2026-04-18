import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHrHarness } from '../helpers/hr-test-store.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { PrismaService } = require('../../dist/src/prisma/prisma.service.js');
const { ClsService } = require('nestjs-cls');
const { HrController } = require('../../dist/src/hr/hr.controller.js');
const { HrService } = require('../../dist/src/hr/hr.service.js');
const { HrExceptionFilter } = require('../../dist/src/hr/hr-exception.filter.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');
const { RolesGuard } = require('../../dist/src/common/guards/roles.guard.js');

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HrController],
    providers: [
      HrService,
      { provide: PrismaService, useValue: harness.prisma },
      { provide: ClsService, useValue: harness.cls },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers['x-roles'];
    req.user = {
      userId: typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : 'hr-user',
      email: 'test@amdox.dev',
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
  app.useGlobalFilters(new HrExceptionFilter());
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

test('hr api creates employee and department resources and exposes recursive reads', async () => {
  const harness = createHrHarness();
  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const rootDepartment = (
    await api.post('/api/v1/hr/departments').send({
      name: 'Operations',
      code: 'OPS',
    })
  ).body;

  const childDepartment = (
    await api.post('/api/v1/hr/departments').send({
      name: 'Support',
      code: 'SUP',
      parentId: rootDepartment.id,
    })
  ).body;

  const manager = (
    await api.post('/api/v1/hr/employees').send({
      employeeCode: 'MGR-API',
      firstName: 'Mina',
      lastName: 'Manager',
      email: 'mina.manager@amdox.dev',
      hireDate: '2026-04-01T00:00:00.000Z',
      departmentId: rootDepartment.id,
    })
  ).body;

  const employee = (
    await api.post('/api/v1/hr/employees').send({
      employeeCode: 'EMP-API',
      firstName: 'Eli',
      lastName: 'Employee',
      email: 'eli.employee@amdox.dev',
      hireDate: '2026-04-01T00:00:00.000Z',
      departmentId: childDepartment.id,
      managerId: manager.id,
    })
  ).body;

  const departmentHead = await api.patch(`/api/v1/hr/departments/${childDepartment.id}`).send({
    headId: employee.id,
  });
  assert.equal(departmentHead.status, 200);

  const orgChart = await api.get('/api/v1/hr/org-chart').set('x-roles', 'viewer');
  assert.equal(orgChart.status, 200);
  assert.deepEqual(
    orgChart.body.map((row) => row.depth),
    [0, 1],
  );

  const departmentTree = await api.get('/api/v1/hr/departments/tree').set('x-roles', 'viewer');
  assert.equal(departmentTree.status, 200);
  assert.deepEqual(
    departmentTree.body.map((row) => row.depth),
    [0, 1],
  );

  const roster = await api
    .get('/api/v1/hr/employees')
    .query({ activeRoster: true })
    .set('x-roles', 'viewer');
  assert.equal(roster.status, 200);
  assert.equal(roster.body.length, 2);

  const crossTenant = await api
    .get('/api/v1/hr/org-chart')
    .set('x-roles', 'viewer')
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2');
  assert.equal(crossTenant.status, 403);

  await app.close();
});
