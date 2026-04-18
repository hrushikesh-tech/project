import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHrHarness } from '../helpers/hr-test-store.mjs';

const require = createRequire(import.meta.url);
const { HrService } = require('../../dist/src/hr/hr.service.js');
const { DepartmentHeadValidationException } = require('@amdox/types');

test('hr service creates pre-start employees and filters active roster by effective dates', async () => {
  const harness = createHrHarness();
  const service = new HrService(harness.prisma, harness.cls);
  const department = harness.insertDepartment({ code: 'ENG', name: 'Engineering' });

  const preStart = await service.createEmployee({
    employeeCode: 'EMP-001',
    firstName: 'Pre',
    lastName: 'Start',
    email: 'prestart@amdox.dev',
    hireDate: '2026-12-01T00:00:00.000Z',
    departmentId: department.id,
  });
  assert.equal(preStart.status, 'PRE_START');

  const active = await service.createEmployee({
    employeeCode: 'EMP-002',
    firstName: 'Active',
    lastName: 'Roster',
    email: 'active@amdox.dev',
    hireDate: '2026-04-01T00:00:00.000Z',
    departmentId: department.id,
  });
  assert.equal(active.status, 'ACTIVE');

  const roster = await service.listEmployees({ activeRoster: true });
  assert.equal(roster.length, 1);
  assert.equal(roster[0].employeeCode, 'EMP-002');
});

test('hr service schedules future terminations and validates same-department heads', async () => {
  const harness = createHrHarness();
  const service = new HrService(harness.prisma, harness.cls);
  const engineering = harness.insertDepartment({ code: 'ENG', name: 'Engineering' });
  const finance = harness.insertDepartment({ code: 'FIN', name: 'Finance' });
  const engineer = harness.insertEmployee({
    departmentId: engineering.id,
    employeeCode: 'EMP-100',
    hireDate: new Date('2026-04-01T00:00:00.000Z'),
    status: 'ACTIVE',
  });

  const updated = await service.updateEmployee(engineer.id, {
    terminationDate: '2026-12-31T00:00:00.000Z',
  });
  assert.equal(updated.status, 'ACTIVE');
  assert.equal(updated.terminationDate.toISOString(), '2026-12-31T00:00:00.000Z');

  await assert.rejects(
    () =>
      service.updateDepartment(finance.id, {
        headId: engineer.id,
      }),
    DepartmentHeadValidationException,
  );

  const financeHead = harness.insertEmployee({
    departmentId: finance.id,
    employeeCode: 'EMP-101',
    hireDate: new Date('2026-04-01T00:00:00.000Z'),
    status: 'ACTIVE',
  });
  const department = await service.updateDepartment(finance.id, {
    headId: financeHead.id,
  });
  assert.equal(department.headId, financeHead.id);
});

test('hr service returns recursive org-chart and department-tree depth values', async () => {
  const harness = createHrHarness();
  const service = new HrService(harness.prisma, harness.cls);

  const rootDepartment = harness.insertDepartment({ code: 'ROOT', name: 'Root' });
  const childDepartment = harness.insertDepartment({
    code: 'CHILD',
    name: 'Child',
    parentId: rootDepartment.id,
  });
  const grandChildDepartment = harness.insertDepartment({
    code: 'LEAF',
    name: 'Leaf',
    parentId: childDepartment.id,
  });

  const root = harness.insertEmployee({
    departmentId: rootDepartment.id,
    employeeCode: 'EMP-ROOT',
    userId: 'root-user',
  });
  const child = harness.insertEmployee({
    departmentId: childDepartment.id,
    employeeCode: 'EMP-CHILD',
    managerId: root.id,
    userId: 'child-user',
  });
  harness.insertEmployee({
    departmentId: grandChildDepartment.id,
    employeeCode: 'EMP-LEAF',
    managerId: child.id,
    userId: 'leaf-user',
  });

  const orgChart = await service.getOrgChart();
  assert.deepEqual(
    orgChart.map((row) => row.depth),
    [0, 1, 2],
  );

  const departmentTree = await service.getDepartmentTree();
  assert.deepEqual(
    departmentTree.map((row) => row.depth),
    [0, 1, 2],
  );
});
