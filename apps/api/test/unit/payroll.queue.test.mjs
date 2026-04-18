import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const { IndiaTaxService } = require('../../dist/src/payroll/engine/india-tax.service.js');
const { PayrollEngineService } = require('../../dist/src/payroll/engine/payroll-engine.service.js');
const { PayrollProcessor } = require('../../dist/src/payroll/queue/payroll.processor.js');
const { PROCESS_PAYROLL_RUN_JOB } = require('../../dist/src/payroll/queue/payroll.queue.js');

function seedSlabs(harness) {
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 0n, maxIncome: 400000n * 100n, rate: '0', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 400000n * 100n, maxIncome: 800000n * 100n, rate: '5', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 800000n * 100n, maxIncome: 1200000n * 100n, rate: '10', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 1200000n * 100n, maxIncome: null, rate: '20' });
}

function createSnapshot({ employeeId, salaryStructureId, legalEntityId, fiscalPeriodId }) {
  return {
    tenantId: 'tenant-1',
    employeeId,
    salaryStructureId,
    legalEntityId,
    fiscalPeriodId,
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
  };
}

function createQueueFixture(resultCount = 1) {
  const harness = createPayrollHarness();
  seedSlabs(harness);
  const legalEntity = harness.insertLegalEntity({ code: 'IN-LE' });
  const period = harness.insertFiscalPeriod({ legalEntityId: legalEntity.id });
  const expense = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'EXPENSE', code: '5000' });
  const payable = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'LIABILITY', code: '2100' });
  const statutory = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'LIABILITY', code: '2200' });
  const department = harness.insertDepartment({ code: 'OPS', name: 'Operations' });
  const run = harness.insertPayrollRun({
    legalEntityId: legalEntity.id,
    period: '2026-04',
    totalCount: resultCount,
  });

  for (let index = 0; index < resultCount; index += 1) {
    const employee = harness.insertEmployee({
      departmentId: department.id,
      employeeCode: `EMP-${index + 1}`,
      email: `employee-${index + 1}@amdox.dev`,
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
    harness.insertPayrollResult({
      payrollRunId: run.id,
      employeeId: employee.id,
      salaryStructureId: salaryStructure.id,
      inputSnapshot: createSnapshot({
        employeeId: employee.id,
        salaryStructureId: salaryStructure.id,
        legalEntityId: legalEntity.id,
        fiscalPeriodId: period.id,
      }),
    });
  }

  const payrollEngine = new PayrollEngineService(new IndiaTaxService(harness.prisma));
  const payslipPdfService = {
    async renderPayslip() {
      return Buffer.from('pdf');
    },
  };
  const payslipStorageService = {
    async uploadPayslip({ tenantId, payrollRunId, employeeId }) {
      return {
        bucket: 'test-bucket',
        key: `payslips/${tenantId}/${payrollRunId}/${employeeId}.pdf`,
        fileName: `${employeeId}.pdf`,
        contentType: 'application/pdf',
      };
    },
  };
  const postingService = {
    async postRun() {
      return { id: 'journal-1', expense: expense.id, payable: payable.id, statutory: statutory.id };
    },
    async reverseRunPosting() {
      return { id: 'reversal-1' };
    },
  };

  const processor = new PayrollProcessor(
    harness.prisma,
    payrollEngine,
    payslipPdfService,
    payslipStorageService,
    postingService,
  );

  return { harness, processor, run, postingService };
}

test('queue processes payroll results in batches of 100 and completes the run', async () => {
  const { harness, processor, run } = createQueueFixture(105);

  await processor.process({
    name: PROCESS_PAYROLL_RUN_JOB,
    data: { tenantId: 'tenant-1', payrollRunId: run.id },
  });

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  assert.equal(storedRun.status, 'COMPLETED');
  assert.equal(storedRun.processedCount, 105);
  assert.equal(harness.state.payslips.length, 105);
});

test('queue success path generates payslips, posts summarized GL, and emits admin events', async () => {
  const { harness, processor, run } = createQueueFixture(1);

  await processor.process({
    name: PROCESS_PAYROLL_RUN_JOB,
    data: { tenantId: 'tenant-1', payrollRunId: run.id },
  });

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  assert.equal(storedRun.status, 'COMPLETED');
  assert.equal(storedRun.glJournalEntryId, 'journal-1');
  assert.equal(harness.state.outboxEvents.length > 0, true);
  assert.equal(harness.state.notifications.length > 0, true);
});

test('failure before GL posting marks the run FAILED and preserves calculation evidence', async () => {
  const { harness, run } = createQueueFixture(1);
  const payrollEngine = new PayrollEngineService(new IndiaTaxService(harness.prisma));
  const processor = new PayrollProcessor(
    harness.prisma,
    payrollEngine,
    {
      async renderPayslip() {
        throw new Error('pdf failed');
      },
    },
    {
      async uploadPayslip() {
        throw new Error('should not upload');
      },
    },
    {
      async postRun() {
        return { id: 'journal-1' };
      },
      async reverseRunPosting() {
        return { id: 'reversal-1' };
      },
    },
  );

  await assert.rejects(() =>
    processor.process({
      name: PROCESS_PAYROLL_RUN_JOB,
      data: { tenantId: 'tenant-1', payrollRunId: run.id },
    }),
  );

  const storedRun = harness.state.payrollRuns.find((item) => item.id === run.id);
  const storedResult = harness.state.payrollResults.find((item) => item.payrollRunId === run.id);
  assert.equal(storedRun.status, 'FAILED');
  assert.equal(Boolean(storedRun.failureReason), true);
  assert.equal(storedResult.grossPay > 0n, true);
  assert.equal(storedRun.compensationJournalEntryId == null, true);
});

test('failure after GL posting reverses the journal and marks the run FAILED', async () => {
  const { harness, run } = createQueueFixture(1);
  harness.state.payrollRuns.find((item) => item.id === run.id).glJournalEntryId = 'journal-1';
  const payrollEngine = new PayrollEngineService(new IndiaTaxService(harness.prisma));
  let reversed = false;
  const processor = new PayrollProcessor(
    harness.prisma,
    payrollEngine,
    {
      async renderPayslip() {
        throw new Error('pdf failed after posting');
      },
    },
    {
      async uploadPayslip({ tenantId, payrollRunId, employeeId }) {
        return {
          bucket: 'test-bucket',
          key: `payslips/${tenantId}/${payrollRunId}/${employeeId}.pdf`,
          fileName: `${employeeId}.pdf`,
          contentType: 'application/pdf',
        };
      },
    },
    {
      async postRun() {
        return { id: 'journal-1' };
      },
      async reverseRunPosting() {
        reversed = true;
        return { id: 'reversal-1' };
      },
    },
  );
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
});
