import { createRequire } from 'node:module';
import { createHrHarness } from './hr-test-store.mjs';
import { createFinanceHarness } from './finance-test-store.mjs';
import { Prisma } from './prisma-client.mjs';

const require = createRequire(import.meta.url);

const toDecimal = (value, fallback = '0') =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value ?? fallback));

const toBigInt = (value, fallback = 0n) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  return fallback;
};

const normalizeDate = (value) => {
  if (value == null) return value;
  return value instanceof Date ? value : new Date(value);
};

const clone = (record) => (record ? { ...record } : record);

const matches = (item, where = {}) => {
  if (!where) return true;
  if (Array.isArray(where.AND) && !where.AND.every((clause) => matches(item, clause))) {
    return false;
  }
  if (Array.isArray(where.OR) && !where.OR.some((clause) => matches(item, clause))) {
    return false;
  }

  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND' || key === 'OR' || value === undefined) return true;

    const actual = item[key];
    if (value === null || value instanceof Date || typeof value !== 'object' || Array.isArray(value)) {
      if (actual instanceof Date && value instanceof Date) {
        return actual.getTime() === value.getTime();
      }
      return actual === value;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'in')) return value.in.includes(actual);
    if (Object.prototype.hasOwnProperty.call(value, 'not')) return actual !== value.not;
    if (Object.prototype.hasOwnProperty.call(value, 'lt')) return actual < value.lt;
    if (Object.prototype.hasOwnProperty.call(value, 'lte')) return actual <= value.lte;
    if (Object.prototype.hasOwnProperty.call(value, 'gt')) return actual > value.gt;
    if (Object.prototype.hasOwnProperty.call(value, 'gte')) return actual >= value.gte;
    return actual === value;
  });
};

const maybeSort = (items, orderBy) => {
  if (!orderBy) return items;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...items].sort((left, right) => {
    for (const order of orders) {
      const [field, direction] = Object.entries(order)[0];
      const leftValue = left[field];
      const rightValue = right[field];
      const compare =
        leftValue instanceof Date && rightValue instanceof Date
          ? leftValue.getTime() - rightValue.getTime()
          : typeof leftValue === 'bigint' || typeof rightValue === 'bigint'
            ? Number((leftValue ?? 0n) - (rightValue ?? 0n))
            : String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
      if (compare !== 0) {
        return direction === 'desc' ? -compare : compare;
      }
    }
    return 0;
  });
};

export function createPayrollHarness({ tenantId = 'tenant-1' } = {}) {
  const hr = createHrHarness({ tenantId });
  const finance = createFinanceHarness({ tenantId });
  const state = {
    ...hr.state,
    ...finance.state,
    salaryStructures: [],
    salaryComponents: [],
    payrollRuns: [],
    payrollResults: [],
    payslips: [],
    taxSlabs: [],
  };

  let sequence = 1;
  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const now = () => new Date();

  const ensureEmployeeId = (overrides = {}) =>
    overrides.employeeId ?? hr.state.employees[0]?.id ?? hr.insertEmployee().id;
  const ensureLegalEntityId = (overrides = {}) =>
    overrides.legalEntityId ?? finance.state.legalEntities[0]?.id ?? finance.insertLegalEntity().id;
  const ensureSalaryStructureId = (overrides = {}) =>
    overrides.salaryStructureId ?? state.salaryStructures[0]?.id ?? insertSalaryStructure(overrides).id;
  const ensurePayrollRunId = (overrides = {}) =>
    overrides.payrollRunId ?? state.payrollRuns[0]?.id ?? insertPayrollRun(overrides).id;

  const attachSalaryStructure = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.employee) {
      output.employee = clone(hr.state.employees.find((item) => item.id === record.employeeId) ?? null);
    }
    if (include.legalEntity) {
      output.legalEntity = clone(finance.state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null);
    }
    if (include.components) {
      output.components = state.salaryComponents
        .filter((item) => item.salaryStructureId === record.id && item.deletedAt == null)
        .map(clone);
    }
    return output;
  };

  const attachPayrollResult = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.employee) {
      output.employee = clone(hr.state.employees.find((item) => item.id === record.employeeId) ?? null);
    }
    if (include.salaryStructure) {
      output.salaryStructure = attachSalaryStructure(
        state.salaryStructures.find((item) => item.id === record.salaryStructureId) ?? null,
        include.salaryStructure.include,
      );
    }
    if (include.payslip) {
      output.payslip = clone(state.payslips.find((item) => item.payrollResultId === record.id) ?? null);
    }
    return output;
  };

  const attachPayrollRun = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.legalEntity) {
      output.legalEntity = clone(finance.state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null);
    }
    if (include.payrollResults) {
      output.payrollResults = state.payrollResults
        .filter((item) => item.payrollRunId === record.id && item.deletedAt == null)
        .map((item) => attachPayrollResult(item, include.payrollResults.include));
    }
    return output;
  };

  const attachPayslip = (record) => clone(record);

  const insertSalaryStructure = (overrides = {}) => {
    const record = {
      id: nextId('salary-structure'),
      tenantId: overrides.tenantId ?? tenantId,
      employeeId: ensureEmployeeId(overrides),
      legalEntityId: ensureLegalEntityId(overrides),
      name: overrides.name ?? `Standard CTC ${sequence}`,
      currency: overrides.currency ?? 'INR',
      taxRegime: overrides.taxRegime ?? 'NEW',
      effectiveFrom: normalizeDate(overrides.effectiveFrom ?? new Date('2026-04-01T00:00:00.000Z')),
      effectiveTo: normalizeDate(overrides.effectiveTo ?? null),
      pfApplicable: overrides.pfApplicable ?? true,
      professionalTaxApplicable: overrides.professionalTaxApplicable ?? true,
      overtimeEligible: overrides.overtimeEligible ?? true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.salaryStructures.push(record);
    return clone(record);
  };

  const insertSalaryComponent = (overrides = {}) => {
    const record = {
      id: nextId('salary-component'),
      tenantId: overrides.tenantId ?? tenantId,
      salaryStructureId: ensureSalaryStructureId(overrides),
      code: overrides.code ?? `COMP-${sequence}`,
      name: overrides.name ?? `Component ${sequence}`,
      componentType: overrides.componentType ?? 'EARNING',
      amountMinor: toBigInt(overrides.amountMinor ?? 1000000),
      calculationType: overrides.calculationType ?? 'FIXED',
      isRecurring: overrides.isRecurring ?? true,
      isTaxable: overrides.isTaxable ?? true,
      pfApplicable: overrides.pfApplicable ?? false,
      professionalTaxApplicable: overrides.professionalTaxApplicable ?? false,
      overtimeApplicable: overrides.overtimeApplicable ?? false,
      sortOrder: overrides.sortOrder ?? 0,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.salaryComponents.push(record);
    return clone(record);
  };

  const insertTaxSlab = (overrides = {}) => {
    const record = {
      id: nextId('tax-slab'),
      tenantId: overrides.tenantId ?? tenantId,
      jurisdiction: overrides.jurisdiction ?? 'IN',
      regime: overrides.regime ?? 'NEW',
      minIncome: toBigInt(overrides.minIncome ?? 0),
      maxIncome: overrides.maxIncome == null ? null : toBigInt(overrides.maxIncome),
      rate: toDecimal(overrides.rate, '0'),
      rebateLimit: overrides.rebateLimit == null ? null : toBigInt(overrides.rebateLimit),
      effectiveFrom: normalizeDate(overrides.effectiveFrom ?? new Date('2026-04-01T00:00:00.000Z')),
      effectiveTo: normalizeDate(overrides.effectiveTo ?? null),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.taxSlabs.push(record);
    return clone(record);
  };

  const insertPayrollRun = (overrides = {}) => {
    const record = {
      id: nextId('payroll-run'),
      tenantId: overrides.tenantId ?? tenantId,
      legalEntityId: ensureLegalEntityId(overrides),
      period: overrides.period ?? '2026-04',
      periodStart: normalizeDate(overrides.periodStart ?? new Date('2026-04-01T00:00:00.000Z')),
      periodEnd: normalizeDate(overrides.periodEnd ?? new Date('2026-04-30T23:59:59.999Z')),
      status: overrides.status ?? 'DRAFT',
      processingStage: overrides.processingStage ?? 'QUEUED',
      failureReason: overrides.failureReason ?? null,
      attemptNumber: overrides.attemptNumber ?? 1,
      queuedAt: normalizeDate(overrides.queuedAt ?? now()),
      totalGross: toBigInt(overrides.totalGross ?? 0),
      totalDeductions: toBigInt(overrides.totalDeductions ?? 0),
      totalNet: toBigInt(overrides.totalNet ?? 0),
      processedCount: overrides.processedCount ?? 0,
      totalCount: overrides.totalCount ?? 0,
      startedAt: normalizeDate(overrides.startedAt ?? null),
      completedAt: normalizeDate(overrides.completedAt ?? null),
      glJournalEntryId: overrides.glJournalEntryId ?? null,
      compensationJournalEntryId: overrides.compensationJournalEntryId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.payrollRuns.push(record);
    return clone(record);
  };

  const insertPayrollResult = (overrides = {}) => {
    const record = {
      id: nextId('payroll-result'),
      tenantId: overrides.tenantId ?? tenantId,
      payrollRunId: ensurePayrollRunId(overrides),
      employeeId: ensureEmployeeId(overrides),
      salaryStructureId: overrides.salaryStructureId ?? ensureSalaryStructureId(overrides),
      status: overrides.status ?? 'PENDING',
      processingStage: overrides.processingStage ?? 'SNAPSHOT_CREATED',
      grossPay: toBigInt(overrides.grossPay ?? 5000000),
      totalDeductions: toBigInt(overrides.totalDeductions ?? 500000),
      netPay: toBigInt(overrides.netPay ?? 4500000),
      earnings: overrides.earnings ?? [],
      deductions: overrides.deductions ?? [],
      taxBreakdown: overrides.taxBreakdown ?? {},
      payableDays: toDecimal(overrides.payableDays, '30'),
      lossOfPay: toBigInt(overrides.lossOfPay ?? 0),
      overtime: toBigInt(overrides.overtime ?? 0),
      overtimeHours: toDecimal(overrides.overtimeHours, '0'),
      workingDays: overrides.workingDays ?? 30,
      presentDays: toDecimal(overrides.presentDays, '30'),
      leaveDays: toDecimal(overrides.leaveDays, '0'),
      inputSnapshot: overrides.inputSnapshot ?? null,
      failureReason: overrides.failureReason ?? null,
      processedAt: normalizeDate(overrides.processedAt ?? null),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.payrollResults.push(record);
    return clone(record);
  };

  const insertPayslip = (overrides = {}) => {
    const result = overrides.payrollResultId
      ? state.payrollResults.find((item) => item.id === overrides.payrollResultId)
      : state.payrollResults[0] ?? insertPayrollResult(overrides);
    const record = {
      id: nextId('payslip'),
      tenantId: overrides.tenantId ?? tenantId,
      payrollRunId: overrides.payrollRunId ?? result.payrollRunId,
      payrollResultId: overrides.payrollResultId ?? result.id,
      employeeId: overrides.employeeId ?? result.employeeId,
      grossPay: toBigInt(overrides.grossPay ?? result.grossPay),
      earnings: overrides.earnings ?? result.earnings,
      deductions: overrides.deductions ?? result.deductions,
      netPay: toBigInt(overrides.netPay ?? result.netPay),
      taxBreakdown: overrides.taxBreakdown ?? result.taxBreakdown,
      pdfUrl: overrides.pdfUrl ?? null,
      storageBucket: overrides.storageBucket ?? null,
      storageKey: overrides.storageKey ?? null,
      fileName: overrides.fileName ?? null,
      contentType: overrides.contentType ?? 'application/pdf',
      renderMetadata: overrides.renderMetadata ?? null,
      renderedAt: normalizeDate(overrides.renderedAt ?? null),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.payslips.push(record);
    return clone(record);
  };

  const prisma = hr.prisma;
  prisma.legalEntity = finance.prisma.legalEntity;
  prisma.account = finance.prisma.account;
  prisma.fiscalPeriod = finance.prisma.fiscalPeriod;
  prisma.journalEntry = finance.prisma.journalEntry;
  prisma.journalLine = finance.prisma.journalLine;
  prisma.raw.fxRate = finance.prisma.raw.fxRate;

  prisma.salaryStructure = {
    async findMany({ where = {}, include, orderBy } = {}) {
      return maybeSort(state.salaryStructures.filter((item) => matches(item, where)), orderBy).map((item) =>
        attachSalaryStructure(item, include),
      );
    },
    async findFirst({ where = {}, include } = {}) {
      return attachSalaryStructure(state.salaryStructures.find((item) => matches(item, where)) ?? null, include);
    },
    async findUnique({ where = {}, include } = {}) {
      return attachSalaryStructure(state.salaryStructures.find((item) => matches(item, where)) ?? null, include);
    },
    async create({ data, include } = {}) {
      return attachSalaryStructure(insertSalaryStructure(data), include);
    },
    async update({ where, data, include } = {}) {
      const record = state.salaryStructures.find((item) => matches(item, where));
      Object.assign(record, data, { updatedAt: now() });
      return attachSalaryStructure(record, include);
    },
  };

  prisma.salaryComponent = {
    async findMany({ where = {}, orderBy } = {}) {
      return maybeSort(state.salaryComponents.filter((item) => matches(item, where)), orderBy).map(clone);
    },
    async create({ data } = {}) {
      return insertSalaryComponent(data);
    },
    async createMany({ data = [] } = {}) {
      for (const entry of data) insertSalaryComponent(entry);
      return { count: data.length };
    },
    async deleteMany({ where = {} } = {}) {
      const remaining = state.salaryComponents.filter((item) => !matches(item, where));
      const count = state.salaryComponents.length - remaining.length;
      state.salaryComponents.splice(0, state.salaryComponents.length, ...remaining);
      return { count };
    },
  };

  prisma.taxSlab = {
    async findMany({ where = {}, orderBy } = {}) {
      return maybeSort(state.taxSlabs.filter((item) => matches(item, where)), orderBy).map(clone);
    },
    async findFirst({ where = {} } = {}) {
      return clone(state.taxSlabs.find((item) => matches(item, where)) ?? null);
    },
    async create({ data } = {}) {
      return insertTaxSlab(data);
    },
  };

  prisma.payrollRun = {
    async findMany({ where = {}, include, orderBy } = {}) {
      return maybeSort(state.payrollRuns.filter((item) => matches(item, where)), orderBy).map((item) =>
        attachPayrollRun(item, include),
      );
    },
    async findFirst({ where = {}, include } = {}) {
      return attachPayrollRun(state.payrollRuns.find((item) => matches(item, where)) ?? null, include);
    },
    async findUnique({ where = {}, include } = {}) {
      return attachPayrollRun(state.payrollRuns.find((item) => matches(item, where)) ?? null, include);
    },
    async create({ data, include } = {}) {
      return attachPayrollRun(insertPayrollRun(data), include);
    },
    async update({ where, data, include } = {}) {
      const record = state.payrollRuns.find((item) => matches(item, where));
      Object.assign(record, data, { updatedAt: now() });
      return attachPayrollRun(record, include);
    },
  };

  prisma.payrollResult = {
    async findMany({ where = {}, include, orderBy } = {}) {
      return maybeSort(state.payrollResults.filter((item) => matches(item, where)), orderBy).map((item) =>
        attachPayrollResult(item, include),
      );
    },
    async findFirst({ where = {}, include } = {}) {
      return attachPayrollResult(state.payrollResults.find((item) => matches(item, where)) ?? null, include);
    },
    async findUnique({ where = {}, include } = {}) {
      return attachPayrollResult(state.payrollResults.find((item) => matches(item, where)) ?? null, include);
    },
    async create({ data, include } = {}) {
      return attachPayrollResult(insertPayrollResult(data), include);
    },
    async createMany({ data = [] } = {}) {
      for (const entry of data) insertPayrollResult(entry);
      return { count: data.length };
    },
    async update({ where, data, include } = {}) {
      const record = state.payrollResults.find((item) => matches(item, where));
      Object.assign(record, data, { updatedAt: now() });
      record.payableDays = toDecimal(record.payableDays);
      record.overtimeHours = toDecimal(record.overtimeHours);
      record.presentDays = toDecimal(record.presentDays);
      record.leaveDays = toDecimal(record.leaveDays);
      return attachPayrollResult(record, include);
    },
    async upsert({ where, create, update, include } = {}) {
      const existing = state.payrollResults.find((item) => matches(item, where));
      if (existing) {
        return this.update({ where: { id: existing.id }, data: update, include });
      }
      return this.create({ data: create, include });
    },
  };

  prisma.payslip = {
    async findMany({ where = {}, orderBy } = {}) {
      return maybeSort(state.payslips.filter((item) => matches(item, where)), orderBy).map(attachPayslip);
    },
    async findFirst({ where = {} } = {}) {
      return attachPayslip(state.payslips.find((item) => matches(item, where)) ?? null);
    },
    async findUnique({ where = {} } = {}) {
      return attachPayslip(state.payslips.find((item) => matches(item, where)) ?? null);
    },
    async create({ data } = {}) {
      return insertPayslip(data);
    },
    async update({ where, data } = {}) {
      const record = state.payslips.find((item) => matches(item, where));
      Object.assign(record, data, { updatedAt: now() });
      return attachPayslip(record);
    },
  };

  return {
    prisma,
    cls: hr.cls,
    state,
    setTenantId: hr.setTenantId,
    getTenantId: hr.getTenantId,
    insertUser: hr.insertUser,
    insertEmployee: hr.insertEmployee,
    insertDepartment: hr.insertDepartment,
    insertLeaveType: hr.insertLeaveType,
    insertLeaveBalance: hr.insertLeaveBalance,
    insertLeaveRequest: hr.insertLeaveRequest,
    insertAttendance: hr.insertAttendance,
    insertNotification: hr.insertNotification,
    insertOutboxEvent: hr.insertOutboxEvent,
    insertLegalEntity: finance.insertLegalEntity,
    insertAccount: finance.insertAccount,
    insertFiscalPeriod: finance.insertPeriod,
    insertJournalEntry: finance.insertJournalEntry,
    insertSalaryStructure,
    insertSalaryComponent,
    insertTaxSlab,
    insertPayrollRun,
    insertPayrollResult,
    insertPayslip,
  };
}
