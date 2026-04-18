import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const { IndiaTaxService } = require('../../dist/src/payroll/engine/india-tax.service.js');
const { PayrollEngineService } = require('../../dist/src/payroll/engine/payroll-engine.service.js');
const {
  MissingSalaryStructureException,
  UnsupportedTaxRegimeException,
} = require('@amdox/types');

function seedIndiaTaxSlabs(harness) {
  const lakh = 100000n * 100n;

  harness.insertTaxSlab({ regime: 'OLD', minIncome: 0n, maxIncome: 250000n * 100n, rate: '0', rebateLimit: 500000n * 100n });
  harness.insertTaxSlab({ regime: 'OLD', minIncome: 250000n * 100n, maxIncome: 500000n * 100n, rate: '5', rebateLimit: 500000n * 100n });
  harness.insertTaxSlab({ regime: 'OLD', minIncome: 500000n * 100n, maxIncome: 1000000n * 100n, rate: '20' });
  harness.insertTaxSlab({ regime: 'OLD', minIncome: 1000000n * 100n, maxIncome: null, rate: '30' });

  harness.insertTaxSlab({ regime: 'NEW', minIncome: 0n, maxIncome: 400000n * 100n, rate: '0', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 400000n * 100n, maxIncome: 800000n * 100n, rate: '5', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 800000n * 100n, maxIncome: 1200000n * 100n, rate: '10', rebateLimit: 1200000n * 100n });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 1200000n * 100n, maxIncome: 1600000n * 100n, rate: '15' });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 1600000n * 100n, maxIncome: 2000000n * 100n, rate: '20' });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 2000000n * 100n, maxIncome: 2400000n * 100n, rate: '25' });
  harness.insertTaxSlab({ regime: 'NEW', minIncome: 2400000n * 100n, maxIncome: null, rate: '30' });

  return lakh;
}

function createEngineFixture() {
  const harness = createPayrollHarness();
  seedIndiaTaxSlabs(harness);
  const indiaTaxService = new IndiaTaxService(harness.prisma);
  const payrollEngine = new PayrollEngineService(indiaTaxService);

  return { harness, payrollEngine };
}

function createInput(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    employeeId: 'employee-1',
    salaryStructureId: 'salary-1',
    legalEntityId: 'entity-1',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T23:59:59.999Z',
    currency: 'INR',
    taxRegime: 'NEW',
    workingDays: 30,
    payableDays: 30,
    presentDays: 30,
    leaveDays: 0,
    overtimeHours: 0,
    overtimeEligible: true,
    earningsComponents: [
      {
        code: 'BASIC',
        name: 'Basic',
        amountMinor: 6000000n,
        componentType: 'EARNING',
        isTaxable: true,
        pfApplicable: true,
      },
      {
        code: 'HRA',
        name: 'HRA',
        amountMinor: 2000000n,
        componentType: 'EARNING',
        isTaxable: true,
      },
      {
        code: 'SPECIAL',
        name: 'Special',
        amountMinor: 1000000n,
        componentType: 'EARNING',
        isTaxable: true,
      },
    ],
    deductionComponents: [],
    ...overrides,
  };
}

test('salary scenario 1: new regime low taxable income gets 87A rebate to zero monthly tax', async () => {
  const { payrollEngine } = createEngineFixture();
  const result = await payrollEngine.calculate(
    createInput({
      taxRegime: 'NEW',
      earningsComponents: [
        { code: 'BASIC', name: 'Basic', amountMinor: 3000000n, componentType: 'EARNING', isTaxable: true, pfApplicable: true },
        { code: 'HRA', name: 'HRA', amountMinor: 1000000n, componentType: 'EARNING', isTaxable: true },
      ],
    }),
  );

  assert.equal(result.taxBreakdown.rebateMinor, 0n);
  assert.equal(result.taxBreakdown.monthlyTaxMinor, 0n);
});

test('salary scenario 2: old-regime and new-regime calculations both execute and tag the correct regime', async () => {
  const { payrollEngine } = createEngineFixture();
  const baseInput = createInput({
    earningsComponents: [
      { code: 'BASIC', name: 'Basic', amountMinor: 12000000n, componentType: 'EARNING', isTaxable: true, pfApplicable: true },
      { code: 'HRA', name: 'HRA', amountMinor: 4000000n, componentType: 'EARNING', isTaxable: true },
      { code: 'SPECIAL', name: 'Special', amountMinor: 2000000n, componentType: 'EARNING', isTaxable: true },
    ],
  });
  const oldResult = await payrollEngine.calculate({ ...baseInput, taxRegime: 'OLD' });
  const newResult = await payrollEngine.calculate({ ...baseInput, taxRegime: 'NEW' });

  assert.equal(oldResult.taxBreakdown.regime, 'OLD');
  assert.equal(newResult.taxBreakdown.regime, 'NEW');
  assert.equal(oldResult.taxBreakdown.monthlyTaxMinor > 0n, true);
  assert.equal(newResult.taxBreakdown.monthlyTaxMinor > 0n, true);
});

test('salary scenario 3: PF and professional tax deductions are applied for taxable monthly payroll', async () => {
  const { payrollEngine } = createEngineFixture();
  const result = await payrollEngine.calculate(createInput());

  const pf = result.deductions.find((item) => item.code === 'PF');
  const professionalTax = result.deductions.find((item) => item.code === 'PROFESSIONAL_TAX');
  const incomeTax = result.deductions.find((item) => item.code === 'INCOME_TAX');

  assert.equal(pf.amountMinor, 720000n);
  assert.equal(professionalTax.amountMinor, 20000n);
  assert.equal(incomeTax, undefined);
});

test('salary scenario 4: overtime hours increase gross pay and net pay snapshot', async () => {
  const { payrollEngine } = createEngineFixture();
  const regular = await payrollEngine.calculate(createInput());
  const overtime = await payrollEngine.calculate(createInput({ overtimeHours: 16 }));

  assert.equal(overtime.overtimeAmountMinor > 0n, true);
  assert.equal(overtime.grossPayMinor > regular.grossPayMinor, true);
  assert.equal(overtime.netPayMinor > regular.netPayMinor, true);
});

test('salary scenario 5: loss of pay prorates earnings when payable days drop below working days', async () => {
  const { payrollEngine } = createEngineFixture();
  const result = await payrollEngine.calculate(
    createInput({
      payableDays: 20,
      presentDays: 20,
      leaveDays: 0,
    }),
  );

  assert.equal(result.lossOfPayMinor > 0n, true);
  assert.equal(result.grossPayMinor < 9000000n, true);
});

test('missing salary structure throws MissingSalaryStructureException', async () => {
  const { payrollEngine } = createEngineFixture();

  await assert.rejects(
    () =>
      payrollEngine.calculate(
        createInput({
          earningsComponents: [],
        }),
      ),
    MissingSalaryStructureException,
  );
});

test('missing tax slabs throws UnsupportedTaxRegimeException', async () => {
  const harness = createPayrollHarness();
  const indiaTaxService = new IndiaTaxService(harness.prisma);
  const payrollEngine = new PayrollEngineService(indiaTaxService);

  await assert.rejects(() => payrollEngine.calculate(createInput()), UnsupportedTaxRegimeException);
});
