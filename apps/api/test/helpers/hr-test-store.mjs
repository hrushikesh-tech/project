import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Prisma } = require('@amdox/db');

export function createHrHarness({ tenantId = 'tenant-1' } = {}) {
  const state = {
    tenants: [{ id: tenantId }],
    users: [],
    employees: [],
    departments: [],
    leaveTypes: [],
    leaveBalances: [],
    leaveRequests: [],
    attendances: [],
    notifications: [],
    outboxEvents: [],
  };

  let sequence = 1;
  let currentTenantId = tenantId;

  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (record) => (record ? { ...record } : record);
  const normalizeDate = (value) => {
    if (value == null) return value;
    return value instanceof Date ? value : new Date(value);
  };
  const toDecimal = (value, fallback = '0') =>
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value ?? fallback));
  const sameUtcDate = (left, right) =>
    left instanceof Date &&
    right instanceof Date &&
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate();

  const matches = (item, where = {}) => {
    if (!where) return true;
    if (Array.isArray(where.AND)) {
      return where.AND.every((clause) => matches(item, clause));
    }
    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => matches(item, clause));
    }

    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND' || key === 'OR' || value === undefined) {
        return true;
      }

      const actual = item[key];
      if (value === null || value instanceof Date || typeof value !== 'object' || Array.isArray(value)) {
        if (actual instanceof Date && value instanceof Date) {
          return actual.getTime() === value.getTime();
        }
        return actual === value;
      }

      if (Object.prototype.hasOwnProperty.call(value, 'in')) return value.in.includes(actual);
      if (Object.prototype.hasOwnProperty.call(value, 'lt')) return actual < value.lt;
      if (Object.prototype.hasOwnProperty.call(value, 'lte')) return actual <= value.lte;
      if (Object.prototype.hasOwnProperty.call(value, 'gt')) return actual > value.gt;
      if (Object.prototype.hasOwnProperty.call(value, 'gte')) return actual >= value.gte;
      if (Object.prototype.hasOwnProperty.call(value, 'not')) return actual !== value.not;
      if (Object.prototype.hasOwnProperty.call(value, 'equals')) return actual === value.equals;
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
            : String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
        if (compare !== 0) {
          return direction === 'desc' ? -compare : compare;
        }
      }
      return 0;
    });
  };

  const attachEmployee = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.department) {
      output.department = clone(state.departments.find((item) => item.id === record.departmentId) ?? null);
    }
    if (include.manager) {
      output.manager = attachEmployee(
        state.employees.find((item) => item.id === record.managerId) ?? null,
        include.manager.include,
      );
    }
    if (include.reports) {
      output.reports = state.employees
        .filter((item) => item.managerId === record.id && item.deletedAt == null)
        .map((item) => attachEmployee(item, include.reports.include));
    }
    if (include.headedDepartment) {
      output.headedDepartment = clone(state.departments.find((item) => item.headId === record.id) ?? null);
    }
    return output;
  };

  const attachDepartment = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.parent) {
      output.parent = clone(state.departments.find((item) => item.id === record.parentId) ?? null);
    }
    if (include.children) {
      output.children = state.departments
        .filter((item) => item.parentId === record.id && item.deletedAt == null)
        .map(clone);
    }
    if (include.head) {
      output.head = attachEmployee(
        state.employees.find((item) => item.id === record.headId) ?? null,
        include.head.include,
      );
    }
    if (include.employees) {
      output.employees = state.employees
        .filter((item) => item.departmentId === record.id && item.deletedAt == null)
        .map((item) => attachEmployee(item, include.employees.include));
    }
    return output;
  };

  const attachLeaveBalance = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.employee) {
      output.employee = attachEmployee(
        state.employees.find((item) => item.id === record.employeeId) ?? null,
        include.employee.include,
      );
    }
    if (include.leaveType) {
      output.leaveType = clone(state.leaveTypes.find((item) => item.id === record.leaveTypeId) ?? null);
    }
    return output;
  };

  const attachLeaveRequest = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.employee) {
      output.employee = attachEmployee(
        state.employees.find((item) => item.id === record.employeeId) ?? null,
        include.employee.include,
      );
    }
    if (include.leaveType) {
      output.leaveType = clone(state.leaveTypes.find((item) => item.id === record.leaveTypeId) ?? null);
    }
    return output;
  };

  const attachAttendance = (record, include = {}) => {
    if (!record) return null;
    const output = clone(record);
    if (include.employee) {
      output.employee = attachEmployee(
        state.employees.find((item) => item.id === record.employeeId) ?? null,
        include.employee.include,
      );
    }
    return output;
  };

  const ensureDepartmentId = (overrides = {}) =>
    overrides.departmentId ?? state.departments[0]?.id ?? insertDepartment().id;
  const ensureEmployeeId = (overrides = {}) =>
    overrides.employeeId ?? state.employees[0]?.id ?? insertEmployee().id;
  const ensureLeaveTypeId = (overrides = {}) =>
    overrides.leaveTypeId ?? state.leaveTypes[0]?.id ?? insertLeaveType().id;

  const insertUser = (overrides = {}) => {
    const record = {
      id: nextId('user'),
      tenantId: overrides.tenantId ?? tenantId,
      email: overrides.email ?? `hr-${sequence}@amdox.dev`,
      firstName: overrides.firstName ?? 'HR',
      lastName: overrides.lastName ?? 'User',
      keycloakId: overrides.keycloakId ?? `kc-${sequence}`,
      role: overrides.role ?? 'viewer',
      isActive: overrides.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.users.push(record);
    return clone(record);
  };

  const insertDepartment = (overrides = {}) => {
    const record = {
      id: nextId('dept'),
      tenantId: overrides.tenantId ?? tenantId,
      name: overrides.name ?? `Department ${sequence}`,
      code: overrides.code ?? `DEPT-${sequence}`,
      parentId: overrides.parentId ?? null,
      headId: overrides.headId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.departments.push(record);
    return clone(record);
  };

  const insertEmployee = (overrides = {}) => {
    const record = {
      id: nextId('employee'),
      tenantId: overrides.tenantId ?? tenantId,
      employeeCode: overrides.employeeCode ?? `EMP-${sequence}`,
      userId: overrides.userId ?? null,
      firstName: overrides.firstName ?? 'Amdox',
      lastName: overrides.lastName ?? `Employee ${sequence}`,
      email: overrides.email ?? `employee-${sequence}@amdox.dev`,
      phone: overrides.phone ?? null,
      dateOfBirth: normalizeDate(overrides.dateOfBirth ?? null),
      hireDate: normalizeDate(overrides.hireDate ?? new Date('2026-04-01T00:00:00.000Z')),
      terminationDate: normalizeDate(overrides.terminationDate ?? null),
      status: overrides.status ?? 'ACTIVE',
      departmentId: ensureDepartmentId(overrides),
      designationId: overrides.designationId ?? null,
      managerId: overrides.managerId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.dateOfBirth = normalizeDate(record.dateOfBirth);
    record.hireDate = normalizeDate(record.hireDate);
    record.terminationDate = normalizeDate(record.terminationDate);
    state.employees.push(record);
    return clone(record);
  };

  const insertLeaveType = (overrides = {}) => {
    const record = {
      id: nextId('leave-type'),
      tenantId: overrides.tenantId ?? tenantId,
      name: overrides.name ?? `Annual Leave ${sequence}`,
      code: overrides.code ?? `AL-${sequence}`,
      accrualRate: toDecimal(overrides.accrualRate, '1.5'),
      maxBalance: toDecimal(overrides.maxBalance, '24'),
      carryForwardLimit: toDecimal(overrides.carryForwardLimit, '0'),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.accrualRate = toDecimal(record.accrualRate);
    record.maxBalance = toDecimal(record.maxBalance);
    record.carryForwardLimit = toDecimal(record.carryForwardLimit);
    state.leaveTypes.push(record);
    return clone(record);
  };

  const insertLeaveBalance = (overrides = {}) => {
    const record = {
      id: nextId('leave-balance'),
      tenantId: overrides.tenantId ?? tenantId,
      employeeId: ensureEmployeeId(overrides),
      leaveTypeId: ensureLeaveTypeId(overrides),
      balance: toDecimal(overrides.balance, '12'),
      year: overrides.year ?? 2026,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.balance = toDecimal(record.balance);
    state.leaveBalances.push(record);
    return clone(record);
  };

  const insertLeaveRequest = (overrides = {}) => {
    const record = {
      id: nextId('leave-request'),
      tenantId: overrides.tenantId ?? tenantId,
      employeeId: ensureEmployeeId(overrides),
      leaveTypeId: ensureLeaveTypeId(overrides),
      startDate: normalizeDate(overrides.startDate ?? new Date('2026-05-01T00:00:00.000Z')),
      endDate: normalizeDate(overrides.endDate ?? new Date('2026-05-03T00:00:00.000Z')),
      status: overrides.status ?? 'DRAFT',
      reason: overrides.reason ?? 'Seed leave request',
      submittedAt: normalizeDate(overrides.submittedAt ?? null),
      approvedBy: overrides.approvedBy ?? null,
      approvedAt: normalizeDate(overrides.approvedAt ?? null),
      rejectedAt: normalizeDate(overrides.rejectedAt ?? null),
      cancelledAt: normalizeDate(overrides.cancelledAt ?? null),
      rejectionReason: overrides.rejectionReason ?? null,
      cancelReason: overrides.cancelReason ?? null,
      systemReason: overrides.systemReason ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.startDate = normalizeDate(record.startDate);
    record.endDate = normalizeDate(record.endDate);
    record.submittedAt = normalizeDate(record.submittedAt);
    record.approvedAt = normalizeDate(record.approvedAt);
    record.rejectedAt = normalizeDate(record.rejectedAt);
    record.cancelledAt = normalizeDate(record.cancelledAt);
    state.leaveRequests.push(record);
    return clone(record);
  };

  const insertAttendance = (overrides = {}) => {
    const record = {
      id: nextId('attendance'),
      tenantId: overrides.tenantId ?? tenantId,
      employeeId: ensureEmployeeId(overrides),
      date: normalizeDate(overrides.date ?? new Date('2026-04-18T00:00:00.000Z')),
      clockIn: normalizeDate(overrides.clockIn ?? null),
      clockOut: normalizeDate(overrides.clockOut ?? null),
      hoursWorked: overrides.hoursWorked == null ? null : toDecimal(overrides.hoursWorked),
      overtimeHours: toDecimal(overrides.overtimeHours, '0'),
      status: overrides.status ?? 'PRESENT',
      correctedBy: overrides.correctedBy ?? null,
      correctedAt: normalizeDate(overrides.correctedAt ?? null),
      correctionReason: overrides.correctionReason ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.date = normalizeDate(record.date);
    record.clockIn = normalizeDate(record.clockIn);
    record.clockOut = normalizeDate(record.clockOut);
    record.correctedAt = normalizeDate(record.correctedAt);
    if (record.hoursWorked != null) {
      record.hoursWorked = toDecimal(record.hoursWorked);
    }
    record.overtimeHours = toDecimal(record.overtimeHours);
    state.attendances.push(record);
    return clone(record);
  };

  const insertNotification = (overrides = {}) => {
    const record = {
      id: nextId('notification'),
      tenantId: overrides.tenantId ?? tenantId,
      userId: overrides.userId ?? state.users[0]?.id ?? insertUser().id,
      type: overrides.type ?? 'hr.leave.rejected',
      channel: overrides.channel ?? 'IN_APP',
      title: overrides.title ?? 'HR update',
      body: overrides.body ?? null,
      isRead: overrides.isRead ?? false,
      readAt: normalizeDate(overrides.readAt ?? null),
      metadata: overrides.metadata ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.notifications.push(record);
    return clone(record);
  };

  const insertOutboxEvent = (overrides = {}) => {
    const record = {
      id: nextId('outbox'),
      tenantId: overrides.tenantId ?? tenantId,
      eventType: overrides.eventType ?? 'hr.leave.rejected',
      payload: overrides.payload ?? {},
      status: overrides.status ?? 'PENDING',
      processedAt: normalizeDate(overrides.processedAt ?? null),
      retryCount: overrides.retryCount ?? 0,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.outboxEvents.push(record);
    return clone(record);
  };

  const buildEmployeeTree = (tenantScope, rootEmployeeId) => {
    const rows = [];
    const roots = state.employees
      .filter(
        (item) =>
          item.tenantId === tenantScope &&
          item.deletedAt == null &&
          (rootEmployeeId ? item.id === rootEmployeeId : item.managerId == null),
      )
      .sort((left, right) => left.employeeCode.localeCompare(right.employeeCode));

    const walk = (employee, depth) => {
      rows.push({
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        departmentId: employee.departmentId,
        managerId: employee.managerId,
        depth,
      });

      const reports = state.employees
        .filter(
          (item) =>
            item.tenantId === tenantScope &&
            item.deletedAt == null &&
            item.managerId === employee.id,
        )
        .sort((left, right) => left.employeeCode.localeCompare(right.employeeCode));

      for (const report of reports) {
        walk(report, depth + 1);
      }
    };

    for (const root of roots) {
      walk(root, 0);
    }

    return rows;
  };

  const buildDepartmentTree = (tenantScope, rootDepartmentId) => {
    const rows = [];
    const roots = state.departments
      .filter(
        (item) =>
          item.tenantId === tenantScope &&
          item.deletedAt == null &&
          (rootDepartmentId ? item.id === rootDepartmentId : item.parentId == null),
      )
      .sort((left, right) => left.code.localeCompare(right.code));

    const walk = (department, depth) => {
      rows.push({
        id: department.id,
        name: department.name,
        code: department.code,
        parentId: department.parentId,
        headId: department.headId,
        depth,
      });

      const children = state.departments
        .filter(
          (item) =>
            item.tenantId === tenantScope &&
            item.deletedAt == null &&
            item.parentId === department.id,
        )
        .sort((left, right) => left.code.localeCompare(right.code));

      for (const child of children) {
        walk(child, depth + 1);
      }
    };

    for (const root of roots) {
      walk(root, 0);
    }

    return rows;
  };

  const scoped = {
    $extends() {
      return scoped;
    },
    async $transaction(callback) {
      return callback(scoped);
    },
    async $queryRawUnsafe(sql, ...params) {
      if (sql.includes('WITH RECURSIVE') && sql.includes('"Employee"')) {
        return buildEmployeeTree(params[0], params[1]);
      }
      if (sql.includes('WITH RECURSIVE') && sql.includes('"Department"')) {
        return buildDepartmentTree(params[0], params[1]);
      }
      return [];
    },
    tenant: null,
    forTenant(requestedTenantId) {
      currentTenantId = requestedTenantId;
      return scoped;
    },
    raw: {
      tenant: {
        async findMany({ where = {} } = {}) {
          return state.tenants.filter((item) => matches(item, where)).map(clone);
        },
      },
      async $queryRawUnsafe(sql, ...params) {
        return scoped.$queryRawUnsafe(sql, ...params);
      },
    },
  };

  scoped.tenant = scoped;

  Object.assign(scoped, {
    employee: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(state.employees.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachEmployee(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachEmployee(state.employees.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        return attachEmployee(state.employees.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachEmployee(insertEmployee(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.employees.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        if (record.hireDate) record.hireDate = normalizeDate(record.hireDate);
        if (record.terminationDate) record.terminationDate = normalizeDate(record.terminationDate);
        return attachEmployee(record, include);
      },
    },
    department: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(state.departments.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachDepartment(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachDepartment(state.departments.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        return attachDepartment(state.departments.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachDepartment(insertDepartment(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.departments.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachDepartment(record, include);
      },
    },
    leaveType: {
      async findMany({ where = {}, orderBy } = {}) {
        return maybeSort(state.leaveTypes.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.leaveTypes.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertLeaveType(data);
      },
    },
    leaveBalance: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(state.leaveBalances.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachLeaveBalance(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachLeaveBalance(state.leaveBalances.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        if (where.tenantId_employeeId_leaveTypeId_year) {
          return attachLeaveBalance(
            state.leaveBalances.find(
              (item) =>
                item.tenantId === where.tenantId_employeeId_leaveTypeId_year.tenantId &&
                item.employeeId === where.tenantId_employeeId_leaveTypeId_year.employeeId &&
                item.leaveTypeId === where.tenantId_employeeId_leaveTypeId_year.leaveTypeId &&
                item.year === where.tenantId_employeeId_leaveTypeId_year.year,
            ) ?? null,
            include,
          );
        }
        return attachLeaveBalance(state.leaveBalances.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachLeaveBalance(insertLeaveBalance(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.leaveBalances.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        record.balance = toDecimal(record.balance);
        return attachLeaveBalance(record, include);
      },
      async upsert({ where, update, create, include } = {}) {
        const existing = await this.findUnique({ where, include });
        if (existing) {
          const record = state.leaveBalances.find((item) => item.id === existing.id);
          Object.assign(record, update, { updatedAt: now() });
          record.balance = toDecimal(record.balance);
          return attachLeaveBalance(record, include);
        }
        return attachLeaveBalance(insertLeaveBalance(create), include);
      },
    },
    leaveRequest: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(state.leaveRequests.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachLeaveRequest(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachLeaveRequest(state.leaveRequests.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        return attachLeaveRequest(state.leaveRequests.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachLeaveRequest(insertLeaveRequest(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.leaveRequests.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        for (const field of ['startDate', 'endDate', 'submittedAt', 'approvedAt', 'rejectedAt', 'cancelledAt']) {
          if (record[field]) record[field] = normalizeDate(record[field]);
        }
        return attachLeaveRequest(record, include);
      },
    },
    attendance: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(state.attendances.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachAttendance(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        if (where.date && typeof where.date === 'object' && where.date.equals instanceof Date) {
          return attachAttendance(
            state.attendances.find(
              (item) =>
                matches(item, { ...where, date: undefined }) && sameUtcDate(item.date, where.date.equals),
            ) ?? null,
            include,
          );
        }
        return attachAttendance(state.attendances.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        if (where.tenantId_employeeId_date) {
          return attachAttendance(
            state.attendances.find(
              (item) =>
                item.tenantId === where.tenantId_employeeId_date.tenantId &&
                item.employeeId === where.tenantId_employeeId_date.employeeId &&
                sameUtcDate(item.date, where.tenantId_employeeId_date.date),
            ) ?? null,
            include,
          );
        }
        return attachAttendance(state.attendances.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachAttendance(insertAttendance(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.attendances.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        for (const field of ['date', 'clockIn', 'clockOut', 'correctedAt']) {
          if (record[field]) record[field] = normalizeDate(record[field]);
        }
        if (record.hoursWorked != null) record.hoursWorked = toDecimal(record.hoursWorked);
        record.overtimeHours = toDecimal(record.overtimeHours);
        return attachAttendance(record, include);
      },
      async upsert({ where, update, create, include } = {}) {
        const existing = await this.findUnique({ where, include });
        if (existing) {
          const record = state.attendances.find((item) => item.id === existing.id);
          Object.assign(record, update, { updatedAt: now() });
          if (record.hoursWorked != null) record.hoursWorked = toDecimal(record.hoursWorked);
          record.overtimeHours = toDecimal(record.overtimeHours);
          return attachAttendance(record, include);
        }
        return attachAttendance(insertAttendance(create), include);
      },
    },
    notification: {
      async findMany({ where = {} } = {}) {
        return state.notifications.filter((item) => matches(item, where)).map(clone);
      },
      async create({ data }) {
        return insertNotification(data);
      },
      async createMany({ data = [] } = {}) {
        for (const item of data) insertNotification(item);
        return { count: data.length };
      },
    },
    outboxEvent: {
      async findMany({ where = {} } = {}) {
        return state.outboxEvents.filter((item) => matches(item, where)).map(clone);
      },
      async create({ data }) {
        return insertOutboxEvent(data);
      },
    },
    user: {
      async findFirst({ where = {} } = {}) {
        return clone(state.users.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertUser(data);
      },
    },
  });

  return {
    prisma: scoped,
    cls: {
      get(key) {
        return key === 'tenantId' ? currentTenantId : undefined;
      },
      set(key, value) {
        if (key === 'tenantId') currentTenantId = value;
      },
    },
    state,
    setTenantId(value) {
      currentTenantId = value;
    },
    getTenantId() {
      return currentTenantId;
    },
    insertUser,
    insertEmployee,
    insertDepartment,
    insertLeaveType,
    insertLeaveBalance,
    insertLeaveRequest,
    insertAttendance,
    insertNotification,
    insertOutboxEvent,
  };
}
