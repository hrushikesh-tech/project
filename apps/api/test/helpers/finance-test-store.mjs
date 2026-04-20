import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Prisma } = require('@amdox/db');
const { JournalEntryStatus } = require('@amdox/types');

export function createFinanceHarness({ tenantId = 'tenant-1' } = {}) {
  const clsState = new Map([['tenantId', tenantId]]);
  const state = {
    tenants: [{ id: tenantId }],
    legalEntities: [],
    accounts: [],
    fiscalPeriods: [],
    journalEntries: [],
    journalLines: [],
    intercompanyTransfers: [],
    fxRates: [],
  };

  let sequence = 1;
  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const now = () => new Date();

  const clone = (record) => (record ? { ...record } : record);

  const getLegalEntity = (id) => state.legalEntities.find((item) => item.id === id) ?? null;
  const getAccount = (id) => state.accounts.find((item) => item.id === id) ?? null;
  const getPeriod = (id) => state.fiscalPeriods.find((item) => item.id === id) ?? null;
  const getJournalEntry = (id) => state.journalEntries.find((item) => item.id === id) ?? null;
  const getJournalLinesForEntry = (journalEntryId) =>
    state.journalLines.filter((item) => item.journalEntryId === journalEntryId);
  const getReversalForEntry = (journalEntryId) =>
    state.journalEntries.find((item) => item.originalEntryId === journalEntryId) ?? null;

  const maybeSort = (items, orderBy) => {
    if (!orderBy || !Array.isArray(orderBy)) {
      return items;
    }

    return [...items].sort((left, right) => {
      for (const order of orderBy) {
        const [field, direction] = Object.entries(order)[0];
        const compare =
          left[field] instanceof Date && right[field] instanceof Date
            ? left[field].getTime() - right[field].getTime()
            : String(left[field]).localeCompare(String(right[field]));
        if (compare !== 0) {
          return direction === 'desc' ? -compare : compare;
        }
      }
      return 0;
    });
  };

  const attachAccount = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.parent) {
      output.parent = clone(getAccount(record.parentId));
    }
    if (include.legalEntity) {
      output.legalEntity = clone(getLegalEntity(record.legalEntityId));
    }
    return output;
  };

  const attachJournalEntry = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.lines) {
      output.lines = getJournalLinesForEntry(record.id).map((line) => {
        const mapped = clone(line);
        if (include.lines.include?.account) {
          mapped.account = clone(getAccount(line.accountId));
        }
        return mapped;
      });
    }
    if (include.legalEntity) {
      output.legalEntity = clone(getLegalEntity(record.legalEntityId));
    }
    if (include.period) {
      output.period = clone(getPeriod(record.periodId));
    }
    if (include.originalEntry) {
      output.originalEntry = clone(getJournalEntry(record.originalEntryId));
    }
    if (include.reversalEntry) {
      output.reversalEntry = clone(getReversalForEntry(record.id));
    }
    return output;
  };

  const scoped = {
    $extends() {
      return scoped;
    },
    async $transaction(callback) {
      return callback(scoped);
    },
  };

  const raw = {
    tenant: {
      async findMany() {
        return clone(state.tenants);
      },
      async findUnique({ where, include } = {}) {
        const tenant = state.tenants.find((item) => item.id === where?.id) ?? null;
        if (!tenant) {
          return null;
        }

        const output = clone(tenant);
        if (include?.legalEntities) {
          let items = state.legalEntities.filter((item) => item.tenantId === tenant.id);
          if (include.legalEntities.where?.id) {
            items = items.filter((item) => item.id === include.legalEntities.where.id);
          }
          if (include.legalEntities.where?.code) {
            items = items.filter((item) => item.code === include.legalEntities.where.code);
          }
          if (Object.prototype.hasOwnProperty.call(include.legalEntities.where ?? {}, 'deletedAt')) {
            items = items.filter((item) => item.deletedAt === include.legalEntities.where.deletedAt);
          }
          items = maybeSort(items, include.legalEntities.orderBy);
          if (include.legalEntities.take) {
            items = items.slice(0, include.legalEntities.take);
          }
          output.legalEntities = items.map(clone);
        }

        return output;
      },
      async update({ where, data, include } = {}) {
        const tenant = state.tenants.find((item) => item.id === where?.id);
        if (!tenant) {
          return null;
        }

        if (data?.legalEntities?.create) {
          const record = {
            id: nextId('entity'),
            tenantId: tenant.id,
            createdAt: now(),
            updatedAt: now(),
            deletedAt: null,
            ...data.legalEntities.create,
          };
          state.legalEntities.push(record);
        }

        return this.findUnique({ where, include });
      },
    },
    fxRate: {
      async findFirst({ where }) {
        return (
          state.fxRates.find(
            (item) =>
              item.tenantId === where.tenantId &&
              item.baseCurrency === where.baseCurrency &&
              item.targetCurrency === where.targetCurrency &&
              item.effectiveDate.getTime() === where.effectiveDate.getTime(),
          ) ?? null
        );
      },
      async upsert({ where, update, create }) {
        const existing = state.fxRates.find(
          (item) =>
            item.tenantId === where.tenantId_baseCurrency_targetCurrency_effectiveDate.tenantId &&
            item.baseCurrency ===
              where.tenantId_baseCurrency_targetCurrency_effectiveDate.baseCurrency &&
            item.targetCurrency ===
              where.tenantId_baseCurrency_targetCurrency_effectiveDate.targetCurrency &&
            item.effectiveDate.getTime() ===
              where.tenantId_baseCurrency_targetCurrency_effectiveDate.effectiveDate.getTime(),
        );

        if (existing) {
          Object.assign(existing, update, { updatedAt: now() });
          return clone(existing);
        }

        const record = {
          id: nextId('fx'),
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...create,
        };
        state.fxRates.push(record);
        return clone(record);
      },
    },
  };

  Object.assign(scoped, {
    raw,
    tenant: scoped,
    legalEntity: {
      async findMany({ orderBy } = {}) {
        return maybeSort(state.legalEntities.map(clone), orderBy);
      },
      async create({ data }) {
        const record = {
          id: nextId('entity'),
          tenantId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...data,
        };
        state.legalEntities.push(record);
        return clone(record);
      },
      async findUnique({ where }) {
        return clone(getLegalEntity(where.id));
      },
      async findFirst({ where } = {}) {
        let items = [...state.legalEntities];
        if (where?.id) {
          items = items.filter((item) => item.id === where.id);
        }
        if (where?.tenantId) {
          items = items.filter((item) => item.tenantId === where.tenantId);
        }
        if (Object.prototype.hasOwnProperty.call(where ?? {}, 'deletedAt')) {
          items = items.filter((item) => item.deletedAt === where.deletedAt);
        }
        return clone(items[0] ?? null);
      },
    },
    account: {
      async findMany({ where = {}, include, orderBy } = {}) {
        let items = [...state.accounts];
        if (where.legalEntityId) {
          items = items.filter((item) => item.legalEntityId === where.legalEntityId);
        }
        if (where.id?.in) {
          items = items.filter((item) => where.id.in.includes(item.id));
        }

        return maybeSort(items, orderBy).map((item) => attachAccount(item, include));
      },
      async create({ data, include } = {}) {
        const record = {
          id: nextId('acct'),
          tenantId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...data,
        };
        state.accounts.push(record);
        return attachAccount(record, include);
      },
      async findUnique({ where }) {
        return clone(getAccount(where.id));
      },
    },
    fiscalPeriod: {
      async findMany({ where = {}, orderBy } = {}) {
        let items = [...state.fiscalPeriods];
        if (where.legalEntityId) {
          items = items.filter((item) => item.legalEntityId === where.legalEntityId);
        }
        return maybeSort(items, orderBy).map(clone);
      },
      async create({ data }) {
        const record = {
          id: nextId('period'),
          tenantId,
          isClosed: false,
          closedAt: null,
          closedBy: null,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...data,
        };
        state.fiscalPeriods.push(record);
        return clone(record);
      },
      async findUnique({ where }) {
        return clone(getPeriod(where.id));
      },
      async findFirst({ where } = {}) {
        let items = [...state.fiscalPeriods];
        if (where?.id) {
          items = items.filter((item) => item.id === where.id);
        }
        if (where?.tenantId) {
          items = items.filter((item) => item.tenantId === where.tenantId);
        }
        if (Object.prototype.hasOwnProperty.call(where ?? {}, 'deletedAt')) {
          items = items.filter((item) => item.deletedAt === where.deletedAt);
        }
        return clone(items[0] ?? null);
      },
      async update({ where, data }) {
        const record = getPeriod(where.id);
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
    },
    journalEntry: {
      async findMany({ where = {}, include, orderBy } = {}) {
        let items = [...state.journalEntries];
        if (where.legalEntityId) {
          items = items.filter((item) => item.legalEntityId === where.legalEntityId);
        }
        if (where.periodId) {
          items = items.filter((item) => item.periodId === where.periodId);
        }
        if (where.status) {
          items = items.filter((item) => item.status === where.status);
        }
        return maybeSort(items, orderBy).map((item) => attachJournalEntry(item, include));
      },
      async findUnique({ where, include } = {}) {
        return attachJournalEntry(getJournalEntry(where.id), include);
      },
      async findFirst({ where = {}, include } = {}) {
        let items = [...state.journalEntries];
        if (where.id) {
          items = items.filter((item) => item.id === where.id);
        }
        if (where.tenantId) {
          items = items.filter((item) => item.tenantId === where.tenantId);
        }
        if (Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
          items = items.filter((item) => item.deletedAt === where.deletedAt);
        }
        return attachJournalEntry(items[0] ?? null, include);
      },
      async create({ data, include }) {
        const record = {
          id: nextId('journal'),
          tenantId,
          postedAt: null,
          postedBy: null,
          originalEntryId: null,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...data,
        };
        delete record.lines;
        state.journalEntries.push(record);

        for (const line of data.lines?.create ?? []) {
          state.journalLines.push({
            id: nextId('line'),
            tenantId,
            createdAt: now(),
            updatedAt: now(),
            deletedAt: null,
            journalEntryId: record.id,
            ...line,
          });
        }

        return attachJournalEntry(record, include);
      },
      async update({ where, data, include }) {
        const record = getJournalEntry(where.id);
        Object.assign(record, data, { updatedAt: now() });
        return attachJournalEntry(record, include);
      },
    },
    journalLine: {
      async findMany({ where = {}, include } = {}) {
        let items = [...state.journalLines];

        if (where.journalEntry) {
          items = items.filter((line) => {
            const entry = getJournalEntry(line.journalEntryId);
            if (!entry) return false;

            if (where.journalEntry.legalEntityId && entry.legalEntityId !== where.journalEntry.legalEntityId) {
              return false;
            }

            if (where.journalEntry.status?.in && !where.journalEntry.status.in.includes(entry.status)) {
              return false;
            }

            const date = entry.date;
            if (where.journalEntry.date?.gte && date < where.journalEntry.date.gte) {
              return false;
            }
            if (where.journalEntry.date?.lte && date > where.journalEntry.date.lte) {
              return false;
            }

            return true;
          });
        }

        return items.map((line) => {
          const mapped = clone(line);
          if (include?.account) {
            mapped.account = clone(getAccount(line.accountId));
          }
          return mapped;
        });
      },
    },
    intercompanyTransfer: {
      async create({ data, include } = {}) {
        const record = {
          id: nextId('ict'),
          tenantId,
          createdAt: now(),
          updatedAt: now(),
          deletedAt: null,
          ...data,
        };
        state.intercompanyTransfers.push(record);

        const output = clone(record);
        if (include?.sourceLegalEntity) {
          output.sourceLegalEntity = clone(getLegalEntity(record.sourceLegalEntityId));
        }
        if (include?.destinationLegalEntity) {
          output.destinationLegalEntity = clone(getLegalEntity(record.destinationLegalEntityId));
        }
        if (include?.sourceEntry) {
          output.sourceEntry = attachJournalEntry(
            getJournalEntry(record.sourceEntryId),
            include.sourceEntry.include,
          );
        }
        if (include?.destinationEntry) {
          output.destinationEntry = attachJournalEntry(
            getJournalEntry(record.destinationEntryId),
            include.destinationEntry.include,
          );
        }
        return output;
      },
    },
  });

  const insertLegalEntity = (overrides = {}) => {
    const record = {
      id: nextId('entity'),
      tenantId,
      code: `LE${sequence}`,
      name: `Entity ${sequence}`,
      baseCurrency: 'INR',
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.legalEntities.push(record);
    return clone(record);
  };

  const insertAccount = (overrides = {}) => {
    const record = {
      id: nextId('acct'),
      tenantId,
      code: `ACC${sequence}`,
      name: `Account ${sequence}`,
      type: 'ASSET',
      legalEntityId: overrides.legalEntityId ?? state.legalEntities[0]?.id,
      parentId: null,
      isActive: true,
      currency: 'INR',
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.accounts.push(record);
    return clone(record);
  };

  const insertPeriod = (overrides = {}) => {
    const record = {
      id: nextId('period'),
      tenantId,
      legalEntityId: overrides.legalEntityId ?? state.legalEntities[0]?.id,
      name: overrides.name ?? `FY-${sequence}`,
      startDate: overrides.startDate ?? new Date('2026-01-01T00:00:00.000Z'),
      endDate: overrides.endDate ?? new Date('2026-12-31T00:00:00.000Z'),
      isClosed: false,
      closedAt: null,
      closedBy: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.fiscalPeriods.push(record);
    return clone(record);
  };

  const insertJournalEntry = (overrides = {}) => {
    const record = {
      id: nextId('journal'),
      tenantId,
      legalEntityId: overrides.legalEntityId ?? state.legalEntities[0]?.id,
      periodId: overrides.periodId ?? state.fiscalPeriods[0]?.id,
      entryNumber: overrides.entryNumber ?? `JE-SEED-${sequence}`,
      date: overrides.date ?? new Date('2026-04-01T00:00:00.000Z'),
      description: overrides.description ?? 'Seed entry',
      status: overrides.status ?? JournalEntryStatus.POSTED,
      postedAt: overrides.postedAt ?? new Date('2026-04-01T00:00:00.000Z'),
      postedBy: overrides.postedBy ?? 'seed-user',
      originalEntryId: overrides.originalEntryId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
    };
    state.journalEntries.push(record);

    for (const line of overrides.lines ?? []) {
      state.journalLines.push({
        id: nextId('line'),
        tenantId,
        journalEntryId: record.id,
        debit: 0n,
        credit: 0n,
        transactionDebit: 0n,
        transactionCredit: 0n,
        currency: 'INR',
        fxRate: new Prisma.Decimal('1'),
        description: null,
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return clone(record);
  };

  const insertFxRate = (overrides = {}) => {
    const record = {
      id: nextId('fx'),
      tenantId,
      baseCurrency: 'USD',
      targetCurrency: 'INR',
      rate: new Prisma.Decimal('82.5'),
      effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
      source: 'seed',
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.fxRates.push(record);
    return clone(record);
  };

  return {
    prisma: scoped,
    cls: {
      get(key) {
        return clsState.get(key);
      },
      set(key, value) {
        clsState.set(key, value);
        return value;
      },
    },
    configService: {
      get(key, fallback) {
        const values = {
          OPENEXCHANGE_APP_ID: 'test-openexchange-key',
          REDIS_URL: 'redis://localhost:6379',
          OPENEXCHANGE_BASE_CURRENCIES: 'USD',
          OPENEXCHANGE_TARGET_CURRENCIES: 'INR,USD,EUR',
        };
        return values[key] ?? fallback;
      },
    },
    state,
    insertLegalEntity,
    insertAccount,
    insertPeriod,
    insertJournalEntry,
    insertFxRate,
  };
}
