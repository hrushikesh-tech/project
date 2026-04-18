import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHrHarness } from '../helpers/hr-test-store.mjs';

const require = createRequire(import.meta.url);
const { HrService } = require('../../dist/src/hr/hr.service.js');
const { HrOperationsProcessor } = require('../../dist/src/hr/queue/hr-operations.processor.js');
const { InvalidLeaveTransitionException } = require('@amdox/types');

function createManagerFixture() {
  const harness = createHrHarness();
  const department = harness.insertDepartment({ code: 'OPS', name: 'Operations' });
  const manager = harness.insertEmployee({
    departmentId: department.id,
    employeeCode: 'MGR-001',
    userId: 'manager-user',
  });
  const employee = harness.insertEmployee({
    departmentId: department.id,
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

  return { harness, department, manager, employee, leaveType };
}

test('leave workflow enforces legal transitions, balance deduction, and restoration rules', async () => {
  const { harness, manager, employee, leaveType } = createManagerFixture();
  const service = new HrService(harness.prisma, harness.cls);
  const actor = { userId: manager.userId, roles: ['viewer'] };

  const leaveRequest = await service.createLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: '2026-06-10T00:00:00.000Z',
    endDate: '2026-06-12T00:00:00.000Z',
    reason: 'Vacation',
  });
  await service.submitLeaveRequest(leaveRequest.id);
  await service.approveLeaveRequest(leaveRequest.id, actor);

  const approvedBalance = harness.state.leaveBalances[0];
  assert.equal(approvedBalance.balance.toString(), '9');

  const cancelled = await service.cancelLeaveRequest(
    leaveRequest.id,
    { reason: 'Plan changed' },
    actor,
  );
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(harness.state.leaveBalances[0].balance.toString(), '12');

  const lateRequest = await service.createLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    reason: 'Short notice',
  });
  await service.submitLeaveRequest(lateRequest.id);
  await service.approveLeaveRequest(lateRequest.id, actor);

  await assert.rejects(
    () => service.cancelLeaveRequest(lateRequest.id, { reason: 'Too late' }, actor),
    InvalidLeaveTransitionException,
  );
});

test('leave rejection, nightly accrual cap, and effective-date termination job all behave as expected', async () => {
  const { harness, manager, employee, leaveType } = createManagerFixture();
  const service = new HrService(harness.prisma, harness.cls);
  const processor = new HrOperationsProcessor(harness.prisma);
  const actor = { userId: manager.userId, roles: ['viewer'] };

  const rejectedRequest = await service.createLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: '2026-07-10T00:00:00.000Z',
    endDate: '2026-07-10T00:00:00.000Z',
    reason: 'Doctor visit',
  });
  await service.submitLeaveRequest(rejectedRequest.id);
  await service.rejectLeaveRequest(rejectedRequest.id, { reason: 'Peak period' }, actor);
  assert.equal(harness.state.outboxEvents.length, 1);
  assert.equal(harness.state.notifications.length, 1);

  harness.state.leaveBalances[0].balance = new (require('@amdox/db').Prisma.Decimal)('23.5');
  await processor.runLeaveAccrual('tenant-1');
  assert.equal(harness.state.leaveBalances[0].balance.toString(), '24');

  const terminatingEmployee = harness.insertEmployee({
    departmentId: harness.state.departments[0].id,
    employeeCode: 'EMP-TERM',
    terminationDate: new Date('2026-01-01T00:00:00.000Z'),
    status: 'ACTIVE',
  });
  await processor.runEmployeeEffectiveStatus('tenant-1');
  assert.equal(
    harness.state.employees.find((item) => item.id === terminatingEmployee.id).status,
    'TERMINATED',
  );
});

test('auto-cancel leaves balances untouched and attendance derives overtime without guessing clock-out', async () => {
  const { harness, manager, employee, leaveType } = createManagerFixture();
  const service = new HrService(harness.prisma, harness.cls);
  const processor = new HrOperationsProcessor(harness.prisma);
  const actor = { userId: manager.userId, roles: ['viewer'] };

  const pendingRequest = harness.insertLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-01-03T00:00:00.000Z'),
    status: 'PENDING',
  });
  const beforeBalance = harness.state.leaveBalances[0].balance.toString();
  await processor.runLeaveAutoCancel('tenant-1');
  assert.equal(
    harness.state.leaveRequests.find((item) => item.id === pendingRequest.id).systemReason,
    'AUTO_CANCELLED_AFTER_START_DATE',
  );
  assert.equal(harness.state.leaveBalances[0].balance.toString(), beforeBalance);

  const incomplete = await service.clockIn({
    employeeId: employee.id,
    timestamp: '2026-04-18T09:00:00.000Z',
  });
  assert.equal(incomplete.clockOut, null);
  assert.equal(incomplete.hoursWorked, null);

  const completed = await service.clockOut({
    employeeId: employee.id,
    timestamp: '2026-04-18T19:30:00.000Z',
  });
  assert.equal(completed.hoursWorked, '10.5');
  assert.equal(completed.overtimeHours, '2.5');

  const corrected = await service.correctAttendance(
    completed.id,
    {
      clockIn: '2026-04-18T08:30:00.000Z',
      clockOut: '2026-04-18T18:30:00.000Z',
      correctionReason: 'Badge sync fix',
    },
    actor,
  );
  assert.equal(corrected.correctedAt instanceof Date, true);
  assert.equal(corrected.correctionReason, 'Badge sync fix');
  assert.equal(corrected.hoursWorked, '10');
});
