import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createFinanceHarness } from '../helpers/finance-test-store.mjs';

const require = createRequire(import.meta.url);
const { FinanceService } = require('../../dist/src/finance/finance.service.js');
const { FxRatesService } = require('../../dist/src/finance/fx-rates.service.js');
const {
  PeriodClosedException,
  PostedEntryImmutableException,
  UnbalancedEntryException,
} = require('@amdox/types');

test('unbalanced journal entry throws UnbalancedEntryException', async () => {
  const harness = createFinanceHarness();
  const fxRatesService = { getRate: async () => ({ toString: () => '1' }) };
  const financeService = new FinanceService(harness.prisma, harness.cls, fxRatesService);

  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const cash = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'ASSET', code: '1000' });
  const revenue = harness.insertAccount({
    legalEntityId: legalEntity.id,
    type: 'REVENUE',
    code: '4000',
  });
  const period = harness.insertPeriod({ legalEntityId: legalEntity.id });

  await assert.rejects(
    () =>
      financeService.createJournalEntry({
        legalEntityId: legalEntity.id,
        periodId: period.id,
        date: '2026-04-01T00:00:00.000Z',
        description: 'Unbalanced entry',
        lines: [
          { accountId: cash.id, debitAmountMinor: 1000, currency: 'INR' },
          { accountId: revenue.id, creditAmountMinor: 900, currency: 'INR' },
        ],
      }),
    UnbalancedEntryException,
  );
});

test('posting to a closed period throws PeriodClosedException', async () => {
  const harness = createFinanceHarness();
  const fxRatesService = { getRate: async () => ({ toString: () => '1' }) };
  const financeService = new FinanceService(harness.prisma, harness.cls, fxRatesService);

  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const cash = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'ASSET', code: '1000' });
  const revenue = harness.insertAccount({
    legalEntityId: legalEntity.id,
    type: 'REVENUE',
    code: '4000',
  });
  const period = harness.insertPeriod({ legalEntityId: legalEntity.id, isClosed: true });

  const entry = await financeService.createJournalEntry({
    legalEntityId: legalEntity.id,
    periodId: period.id,
    date: '2026-04-01T00:00:00.000Z',
    description: 'Closed period entry',
    lines: [
      { accountId: cash.id, debitAmountMinor: 1000, currency: 'INR' },
      { accountId: revenue.id, creditAmountMinor: 1000, currency: 'INR' },
    ],
  });

  await assert.rejects(() => financeService.postJournalEntry(entry.id), PeriodClosedException);
});

test('posted entries are immutable but can be reversed with mirror lines', async () => {
  const harness = createFinanceHarness();
  const fxRatesService = { getRate: async () => ({ toString: () => '1' }) };
  const financeService = new FinanceService(harness.prisma, harness.cls, fxRatesService);

  const legalEntity = harness.insertLegalEntity({ baseCurrency: 'INR' });
  const cash = harness.insertAccount({ legalEntityId: legalEntity.id, type: 'ASSET', code: '1000' });
  const revenue = harness.insertAccount({
    legalEntityId: legalEntity.id,
    type: 'REVENUE',
    code: '4000',
  });
  const period = harness.insertPeriod({ legalEntityId: legalEntity.id });

  const draft = await financeService.createJournalEntry({
    legalEntityId: legalEntity.id,
    periodId: period.id,
    date: '2026-04-01T00:00:00.000Z',
    description: 'Original entry',
    lines: [
      { accountId: cash.id, debitAmountMinor: 1000, currency: 'INR' },
      { accountId: revenue.id, creditAmountMinor: 1000, currency: 'INR' },
    ],
  });

  await financeService.postJournalEntry(draft.id);
  await assert.rejects(
    () => financeService.updateDraftJournalDescription(draft.id, 'Edited after posting'),
    PostedEntryImmutableException,
  );

  const reversal = await financeService.reverseJournalEntry(draft.id, {
    description: 'Reverse original entry',
  });

  assert.equal(reversal.originalEntryId, draft.id);
  assert.equal(
    harness.state.journalEntries.find((entry) => entry.id === draft.id).status,
    'REVERSED',
  );
  assert.equal(harness.state.journalLines.filter((line) => line.journalEntryId === reversal.id).length, 2);
});

test('FX service resolves Redis cache, then DB, then provider fallback', async () => {
  const harness = createFinanceHarness();
  const fxService = new FxRatesService(harness.configService, harness.prisma);
  const cacheWrites = [];

  fxService.redis = {
    status: 'wait',
    async connect() {},
    async get() {
      return '83.15';
    },
    async set(...args) {
      cacheWrites.push(args);
    },
  };

  let rate = await fxService.getRate({
    tenantId: 'tenant-1',
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
  });
  assert.equal(rate.toString(), '83.15');

  fxService.redis.get = async () => null;
  harness.insertFxRate({
    tenantId: 'tenant-1',
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: new Date('2026-04-02T00:00:00.000Z'),
    rate: { toString: () => '84.25' },
  });
  globalThis.fetch = async () => {
    throw new Error('provider should not be called when DB has the rate');
  };

  rate = await fxService.getRate({
    tenantId: 'tenant-1',
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: new Date('2026-04-02T00:00:00.000Z'),
  });
  assert.equal(rate.toString(), '84.25');
  assert.equal(cacheWrites.at(-1)[2], 'EX');
  assert.equal(cacheWrites.at(-1)[3], 60 * 60 * 24);

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        base: 'USD',
        rates: {
          INR: 82.5,
        },
      };
    },
  });

  rate = await fxService.getRate({
    tenantId: 'tenant-1',
    baseCurrency: 'USD',
    targetCurrency: 'INR',
    effectiveDate: new Date('2026-04-03T00:00:00.000Z'),
  });
  assert.equal(rate.toString(), '82.5');
  assert.equal(cacheWrites.at(-1)[2], 'EX');
  assert.equal(cacheWrites.at(-1)[3], 60 * 60 * 24);
});
