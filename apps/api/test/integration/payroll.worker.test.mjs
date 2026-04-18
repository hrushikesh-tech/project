import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const { IndiaTaxService } = require('../../dist/src/payroll/engine/india-tax.service.js');
const { PayrollEngineService } = require('../../dist/src/payroll/engine/payroll-engine.service.js');
const { PayrollProcessor } = require('../../dist/src/payroll/queue/payroll.processor.js');
const { PROCESS_PAYROLL_RUN_JOB } = require('../../dist/src/payroll/queue/payroll.queue.js');

function seedWorkerFixture() {
  const harness = createPayrollHarness();
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 0n, maxIncome: 400000n * 100n, rate: '0', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 400000n * 100n, maxIncome: 800000n * 100n, rate: '5', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 800000n * 100n, maxIncome: null, rate: '10' });

  const legalEntity = harness.insertLegalEntity({ code: 'IND01' });
  const fiscalPeriod = harness.insertFiscalPeriod({
    legalEntityId: legalEntity.id,
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2026-04-30T23:59:59.999Z'),
  });
  harness.insertAccount({ legalEntityId: legalEntity.id, type: 'EXPENSE', code: '5000' });
  harness.insertAccount({ legalEntityId: legalEntity.id, type: 'LIABILITY', code: '2100' });
  harness.insertAccount({ legalEntityId: legalEntity.id, type: 'LIABILITY', code: '2200' });

  const department = harness.insertDepartment({ code: 'OPS', name: 'Operations' });
  const employee = harness.insertEmployee({
    departmentId: department.id,
    employeeCode: 'EMP-001',
  });
  const salaryStructure = harness.insertSalaryStructure({
    employeeId: employee.id,
    legalEntityId: legalEntity.id,
    taxRegime: 'NEW',
  });
  harness.insertSalaryComponent({
    salaryStructureId: salaryStructure.id,
    code: 'BASIC',
    name: 'Basic',
    componentType: 'EARNING',
    amountMinor: 6000000n,
    pfApplicable: true,
  });
  harness.insertSalaryComponent({
    salaryStructureId: salaryStructure.id,
    code: 'HRA',
    name: 'HRA',
    componentType: 'EARNING',
    amountMinor: 2000000n,
  });

  const run = harness.insertPayrollRun({
    legalEntityId: legalEntity.id,
    totalCount: 1,
  });
  harness.insertPayrollResult({
    payrollRunId: run.id,
    employeeId: employee.id,
    salaryStructureId: salaryStructure.id,
    inputSnapshot: {
      tenantId: 'tenant-1',
      employeeId: employee.id,
      salaryStructureId: salaryStructure.id,
      legalEntityId: legalEntity.id,
      fiscalPeriodId: fiscalPeriod.id,
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T23:59:59.999Z',
      currency: 'INR',
      taxRegime: 'NEW',
      workingDays: 30,
      payableDays: 30,
      presentDays: 30,
      leaveDays: 0,
      overtimeHours: 2,
      overtimeEligible: true,
      earningsComponents: [
        { code: 'BASIC', name: 'Basic', amountMinor: 6000000n, componentType: 'EARNING', isTaxable: true, pfApplicable: true },
        { code: 'HRA', name: 'HRA', amountMinor: 2000000n, componentType: 'EARNING', isTaxable: true },
      ],
      deductionComponents: [],
    },
  });

  return { harness, run };
}

function createProcessor(harness, overrides = {}) {
  const payrollEngine = new PayrollEngineService(new IndiaTaxService(harness.prisma));
  return new PayrollProcessor(
    harness.prisma,
    payrollEngine,
    overrides.payslipPdfService ?? {
      async renderPayslip() {
        return Buffer.from('pdf');
      },
    },
    overrides.payslipStorageService ?? {
      async uploadPayslip({ tenantId, payrollRunId, employeeId }) {
        return {
          bucket: 'test-bucket',
          key: `payslips/${tenantId}/${payrollRunId}/${employeeId}.pdf`,
          fileName: `${employeeId}.pdf`,
          contentType: 'application/pdf',
        };
      },
    },
    overrides.postingService ?? {
      async postRun() {
        return { id: 'journal-1' };
      },
      async reverseRunPosting() {
        return { id: 'reversal-1' };
      },
    },
  );
}

test('worker integration completes a payroll run, stores the payslip, and records summarized GL', async () => {
  const { harness, run } = seedWorkerFixture();
  const processor = createProcessor(harness);

  await processor.process({
    name: PROCESS_PAYROLL_RUN_JOB,
    data: { tenantId: 'tenant-1', payrollRunId: run.id },
  });

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  assert.equal(storedRun.status, 'COMPLETED');
  assert.equal(storedRun.glJournalEntryId, 'journal-1');
  assert.equal(harness.state.payslips.length, 1);
  assert.equal(harness.state.payslips[0].storageKey.includes('payslips/tenant-1'), true);
});

test('worker integration marks runs FAILED before GL posting and preserves evidence for inspection', async () => {
  const { harness, run } = seedWorkerFixture();
  const processor = createProcessor(harness, {
    payslipPdfService: {
      async renderPayslip() {
        throw new Error('pdf generation failed');
      },
    },
  });

  await assert.rejects(() =>
    processor.process({
      name: PROCESS_PAYROLL_RUN_JOB,
      data: { tenantId: 'tenant-1', payrollRunId: run.id },
    }),
  );

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  const result = harness.state.payrollResults.find((item) => item.payrollRunId === run.id);
  assert.equal(storedRun.status, 'FAILED');
  assert.equal(Boolean(storedRun.failureReason), true);
  assert.equal(result.grossPay > 0n, true);
});

test('worker integration reverses the journal and emits admin records on post-GL failure', async () => {
  const { harness, run } = seedWorkerFixture();
  harness.state.payrollRuns.find((item) => item.id === run.id).glJournalEntryId = 'journal-1';
  let reversed = false;
  const processor = createProcessor(harness, {
    payslipPdfService: {
      async renderPayslip() {
        throw new Error('pdf generation failed after posting');
      },
    },
    postingService: {
      async postRun() {
        return { id: 'journal-1' };
      },
      async reverseRunPosting() {
        reversed = true;
        return { id: 'reversal-1' };
      },
    },
  });

  await assert.rejects(() =>
    processor.process({
      name: PROCESS_PAYROLL_RUN_JOB,
      data: { tenantId: 'tenant-1', payrollRunId: run.id },
    }),
  );

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  assert.equal(reversed, true);
  assert.equal(storedRun.status, 'FAILED');
  assert.equal(storedRun.compensationJournalEntryId, 'reversal-1');
  assert.equal(harness.state.outboxEvents.length > 0, true);
  assert.equal(harness.state.notifications.length > 0, true);
});
