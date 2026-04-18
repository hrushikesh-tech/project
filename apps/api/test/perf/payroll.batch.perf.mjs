import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const { IndiaTaxService } = require('../../dist/src/payroll/engine/india-tax.service.js');
const { PayrollEngineService } = require('../../dist/src/payroll/engine/payroll-engine.service.js');
const { PayrollProcessor } = require('../../dist/src/payroll/queue/payroll.processor.js');
const { PROCESS_PAYROLL_RUN_JOB } = require('../../dist/src/payroll/queue/payroll.queue.js');

const EMPLOYEE_COUNT = 10000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function seedSlabs(harness) {
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 0n, maxIncome: 400000n * 100n, rate: '0', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 400000n * 100n, maxIncome: 800000n * 100n, rate: '5', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 800000n * 100n, maxIncome: null, rate: '10' });
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
    overtimeHours: 1,
    overtimeEligible: true,
    earningsComponents: [
      { code: 'BASIC', name: 'Basic', amountMinor: 6000000n, componentType: 'EARNING', isTaxable: true, pfApplicable: true },
      { code: 'HRA', name: 'HRA', amountMinor: 2000000n, componentType: 'EARNING', isTaxable: true },
    ],
    deductionComponents: [],
  };
}

const harness = createPayrollHarness();
seedSlabs(harness);

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
const run = harness.insertPayrollRun({
  legalEntityId: legalEntity.id,
  totalCount: EMPLOYEE_COUNT,
});

for (let index = 0; index < EMPLOYEE_COUNT; index += 1) {
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
      fiscalPeriodId: fiscalPeriod.id,
    }),
  });
}

const processor = new PayrollProcessor(
  harness.prisma,
  new PayrollEngineService(new IndiaTaxService(harness.prisma)),
  {
    async renderPayslip() {
      return Buffer.from('pdf');
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
      return { id: 'reversal-1' };
    },
  },
);

const startedAt = performance.now();
await processor.process({
  name: PROCESS_PAYROLL_RUN_JOB,
  data: { tenantId: 'tenant-1', payrollRunId: run.id },
});
const durationMs = performance.now() - startedAt;

assert.equal(harness.state.payrollRuns.find((item) => item.id === run.id).status, 'COMPLETED');
assert.equal(durationMs < FIVE_MINUTES_MS, true);

console.log(`Processed ${EMPLOYEE_COUNT} employees in ${Math.round(durationMs)}ms`);
