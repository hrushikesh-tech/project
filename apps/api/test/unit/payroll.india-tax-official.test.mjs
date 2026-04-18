import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayrollHarness } from '../helpers/payroll-test-store.mjs';

const require = createRequire(import.meta.url);
const { IndiaTaxService } = require('../../dist/src/payroll/engine/india-tax.service.js');

function seedAy202627Slabs(harness) {
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
}

function createTaxService() {
  const harness = createPayrollHarness();
  seedAy202627Slabs(harness);
  return new IndiaTaxService(harness.prisma);
}

function monthlyMinorFromAnnualGrossRupees(annualGrossRupees) {
  return BigInt((annualGrossRupees * 100) / 12);
}

test('official scenario 1: AY 2026-27 new regime rebate zeroes tax below INR 12 lakh taxable income', async () => {
  const service = createTaxService();
  const result = await service.calculateMonthlyTax({
    tenantId: 'tenant-1',
    taxRegime: 'NEW',
    monthlyEarningsMinor: monthlyMinorFromAnnualGrossRupees(1249998),
    pretaxDeductionsMinor: 0n,
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.taxableIncomeMinor, 119999800n);
  assert.equal(result.rebateMinor, 5999980n);
  assert.equal(result.annualTaxMinor, 0n);
  assert.equal(result.monthlyTaxMinor, 0n);
});

test('official scenario 2: AY 2026-27 new regime INR 14.5 lakh taxable income includes 4% cess', async () => {
  const service = createTaxService();
  const result = await service.calculateMonthlyTax({
    tenantId: 'tenant-1',
    taxRegime: 'NEW',
    monthlyEarningsMinor: monthlyMinorFromAnnualGrossRupees(1500000),
    pretaxDeductionsMinor: 0n,
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.taxableIncomeMinor, 145000000n);
  assert.equal(result.rebateMinor, 0n);
  assert.equal(result.annualTaxMinor, 10140000n);
  assert.equal(result.monthlyTaxMinor, 845000n);
});

test('official scenario 3: AY 2026-27 new regime INR 24.5 lakh taxable income matches slab-plus-cess totals', async () => {
  const service = createTaxService();
  const result = await service.calculateMonthlyTax({
    tenantId: 'tenant-1',
    taxRegime: 'NEW',
    monthlyEarningsMinor: monthlyMinorFromAnnualGrossRupees(2550000),
    pretaxDeductionsMinor: 0n,
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.taxableIncomeMinor, 250000000n);
  assert.equal(result.annualTaxMinor, 34320000n);
  assert.equal(result.monthlyTaxMinor, 2860000n);
});

test('official scenario 4: AY 2026-27 old regime rebate zeroes tax below INR 5 lakh taxable income', async () => {
  const service = createTaxService();
  const result = await service.calculateMonthlyTax({
    tenantId: 'tenant-1',
    taxRegime: 'OLD',
    monthlyEarningsMinor: monthlyMinorFromAnnualGrossRupees(549999),
    pretaxDeductionsMinor: 0n,
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.taxableIncomeMinor, 49999900n);
  assert.equal(result.rebateMinor, 1249995n);
  assert.equal(result.annualTaxMinor, 0n);
  assert.equal(result.monthlyTaxMinor, 0n);
});

test('official scenario 5: AY 2026-27 old regime INR 8.5 lakh taxable income includes 4% cess', async () => {
  const service = createTaxService();
  const result = await service.calculateMonthlyTax({
    tenantId: 'tenant-1',
    taxRegime: 'OLD',
    monthlyEarningsMinor: monthlyMinorFromAnnualGrossRupees(900000),
    pretaxDeductionsMinor: 0n,
    periodEnd: new Date('2026-04-30T23:59:59.999Z'),
  });

  assert.equal(result.taxableIncomeMinor, 85000000n);
  assert.equal(result.annualTaxMinor, 8580000n);
  assert.equal(result.monthlyTaxMinor, 715000n);
});
