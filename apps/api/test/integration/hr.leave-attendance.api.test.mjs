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
const { HrOperationsProcessor } = require('../../dist/src/hr/queue/hr-operations.processor.js');
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
      userId:
        typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : 'manager-user',
      email: 'test@amdox.dev',
      roles:
        typeof rolesHeader === 'string'
          ? rolesHeader.split(',').map((value) => value.trim()).filter(Boolean)
          : ['viewer'],
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

test('hr api handles leave workflows, processor auto-cancel, attendance correction, and tenant denial', async () => {
  const harness = createHrHarness();
  const processor = new HrOperationsProcessor(harness.prisma);
  const managerDepartment = harness.insertDepartment({ code: 'OPS', name: 'Operations' });
  const manager = harness.insertEmployee({
    departmentId: managerDepartment.id,
    employeeCode: 'MGR-001',
    userId: 'manager-user',
  });
  const employee = harness.insertEmployee({
    departmentId: managerDepartment.id,
    employeeCode: 'EMP-001',
    managerId: manager.id,
    userId: 'employee-user',
  });
  const leaveType = harness.insertLeaveType({
    code: 'AL',
    accrualRate: '1.5',
    maxBalance: '24',
  });
  harness.insertLeaveBalance({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    balance: '12',
    year: 2026,
  });

  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const approveRequest = (
    await api.post('/api/v1/hr/leave-requests').send({
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-08-10T00:00:00.000Z',
      endDate: '2026-08-12T00:00:00.000Z',
      reason: 'Family trip',
    })
  ).body;
  await api.post(`/api/v1/hr/leave-requests/${approveRequest.id}/submit`).send({});
  const approved = await api
    .post(`/api/v1/hr/leave-requests/${approveRequest.id}/approve`)
    .set('x-user-id', 'manager-user')
    .set('x-roles', 'viewer')
    .send({});
  assert.equal(approved.status, 201);

  const rejectRequest = (
    await api.post('/api/v1/hr/leave-requests').send({
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-09-10T00:00:00.000Z',
      endDate: '2026-09-11T00:00:00.000Z',
      reason: 'Workshop',
    })
  ).body;
  await api.post(`/api/v1/hr/leave-requests/${rejectRequest.id}/submit`).send({});
  const rejected = await api
    .post(`/api/v1/hr/leave-requests/${rejectRequest.id}/reject`)
    .set('x-user-id', 'manager-user')
    .set('x-roles', 'viewer')
    .send({ reason: 'Coverage needed' });
  assert.equal(rejected.status, 201);
  assert.equal(harness.state.outboxEvents.length, 1);
  assert.equal(harness.state.notifications.length, 1);

  const cancelRequest = (
    await api.post('/api/v1/hr/leave-requests').send({
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      startDate: '2026-11-10T00:00:00.000Z',
      endDate: '2026-11-12T00:00:00.000Z',
      reason: 'Rescheduled trip',
    })
  ).body;
  await api.post(`/api/v1/hr/leave-requests/${cancelRequest.id}/submit`).send({});
  await api
    .post(`/api/v1/hr/leave-requests/${cancelRequest.id}/approve`)
    .set('x-user-id', 'manager-user')
    .set('x-roles', 'viewer')
    .send({});
  const cancelled = await api
    .post(`/api/v1/hr/leave-requests/${cancelRequest.id}/cancel`)
    .set('x-user-id', 'manager-user')
    .set('x-roles', 'viewer')
    .send({ reason: 'Trip cancelled' });
  assert.equal(cancelled.status, 201);

  const pending = harness.insertLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-03T00:00:00.000Z',
    status: 'PENDING',
  });
  await processor.runLeaveAutoCancel('tenant-1');
  assert.equal(
    harness.state.leaveRequests.find((item) => item.id === pending.id).systemReason,
    'AUTO_CANCELLED_AFTER_START_DATE',
  );

  const clockIn = await api.post('/api/v1/hr/attendance/clock-in').send({
    employeeId: employee.id,
    timestamp: '2026-04-18T09:00:00.000Z',
  });
  assert.equal(clockIn.status, 201);
  const clockOut = await api.post('/api/v1/hr/attendance/clock-out').send({
    employeeId: employee.id,
    timestamp: '2026-04-18T18:30:00.000Z',
  });
  assert.equal(clockOut.status, 201);
  const corrected = await api
    .patch(`/api/v1/hr/attendance/${clockOut.body.id}/correct`)
    .set('x-user-id', 'manager-user')
    .set('x-roles', 'viewer')
    .send({
      clockIn: '2026-04-18T08:30:00.000Z',
      clockOut: '2026-04-18T18:30:00.000Z',
      correctionReason: 'Device sync issue',
    });
  assert.equal(corrected.status, 200);

  const forbidden = await api
    .get('/api/v1/hr/attendance')
    .set('x-auth-tenant', 'tenant-1')
    .set('x-tenant-id', 'tenant-2')
    .set('x-roles', 'viewer');
  assert.equal(forbidden.status, 403);

  await app.close();
});
