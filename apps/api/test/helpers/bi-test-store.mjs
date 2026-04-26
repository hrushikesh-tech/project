import { createForecastHarness } from "./forecast-test-store.mjs";
import { Prisma } from "./prisma-client.mjs";

export function createBiHarness(options = {}) {
  const base = createForecastHarness(options);
  const state = base.state;
  const tenantId = options.tenantId ?? state.tenants[0]?.id ?? "tenant-1";

  Object.assign(state, {
    dashboards: state.dashboards ?? [],
    widgets: state.widgets ?? [],
    reportSchedules: state.reportSchedules ?? [],
    reportRuns: state.reportRuns ?? [],
    departments: state.departments ?? [],
    employees: state.employees ?? [],
    leaveTypes: state.leaveTypes ?? [],
    leaveRequests: state.leaveRequests ?? [],
    projects: state.projects ?? [],
    users: state.users ?? [],
    notifications: state.notifications ?? [],
    outboxEvents: state.outboxEvents ?? [],
  });

  let sequence = 1;
  const nextId = (prefix) => `bi-${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (value) => (value == null ? value : { ...value });
  const toDecimal = (value, fallback = "0") =>
    value instanceof Prisma.Decimal
      ? value
      : new Prisma.Decimal(String(value ?? fallback));
  const toDate = (value) => (value instanceof Date ? value : value ? new Date(value) : null);

  const matchesScalar = (actual, expected) => {
    if (expected === undefined) return true;
    if (expected instanceof Prisma.Decimal) {
      return toDecimal(actual).equals(expected);
    }
    if (expected instanceof Date) {
      return toDate(actual)?.getTime() === expected.getTime();
    }
    return actual === expected;
  };

  const matches = (item, where = {}) => {
    if (!where) return true;

    return Object.entries(where).every(([key, expected]) => {
      if (expected === undefined) return true;
      const actual = item[key];
      if (expected && typeof expected === "object" && !Array.isArray(expected)) {
        if (expected.in) {
          return expected.in.some((candidate) => matchesScalar(actual, candidate));
        }
        if (expected.not !== undefined) {
          return !matchesScalar(actual, expected.not);
        }
        if (expected.gte !== undefined) {
          if (actual instanceof Date || expected.gte instanceof Date) {
            return toDate(actual)?.getTime() >= toDate(expected.gte)?.getTime();
          }
          return toDecimal(actual).greaterThanOrEqualTo(toDecimal(expected.gte));
        }
        if (expected.lte !== undefined) {
          if (actual instanceof Date || expected.lte instanceof Date) {
            return toDate(actual)?.getTime() <= toDate(expected.lte)?.getTime();
          }
          return toDecimal(actual).lessThanOrEqualTo(toDecimal(expected.lte));
        }
        return true;
      }
      return matchesScalar(actual, expected);
    });
  };

  const sortItems = (items, orderBy) => {
    const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    if (orders.length === 0) return [...items];

    return [...items].sort((left, right) => {
      for (const order of orders) {
        const [field, direction] = Object.entries(order)[0];
        const leftValue = left[field];
        const rightValue = right[field];
        let result = 0;

        if (leftValue instanceof Date && rightValue instanceof Date) {
          result = leftValue.getTime() - rightValue.getTime();
        } else if (
          leftValue instanceof Prisma.Decimal ||
          rightValue instanceof Prisma.Decimal
        ) {
          result = toDecimal(leftValue).sub(toDecimal(rightValue)).toNumber();
        } else {
          result = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
        }

        if (result !== 0) {
          return direction === "desc" ? -result : result;
        }
      }
      return 0;
    });
  };

  const ensureUser = (overrides = {}) => {
    const record = {
      id: nextId("user"),
      email: overrides.email ?? `bi-user-${sequence}@amdox.dev`,
      firstName: overrides.firstName ?? "BI",
      lastName: overrides.lastName ?? "User",
      keycloakId: overrides.keycloakId ?? `bi-keycloak-${sequence}`,
      tenantId,
      role: overrides.role ?? "tenant_admin",
      isActive: overrides.isActive ?? true,
      lastLoginAt: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.users.push(record);
    return clone(record);
  };

  const ensureDepartment = (overrides = {}) => {
    const record = {
      id: nextId("department"),
      name: overrides.name ?? `Department ${sequence}`,
      code: overrides.code ?? `DEPT-${sequence}`,
      parentId: overrides.parentId ?? null,
      headId: overrides.headId ?? null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.departments.push(record);
    return clone(record);
  };

  const ensureEmployee = (overrides = {}) => {
    const departmentId =
      overrides.departmentId ?? state.departments[0]?.id ?? ensureDepartment().id;
    const record = {
      id: nextId("employee"),
      employeeCode: overrides.employeeCode ?? `EMP-${sequence}`,
      userId: overrides.userId ?? null,
      firstName: overrides.firstName ?? "Employee",
      lastName: overrides.lastName ?? `${sequence}`,
      email: overrides.email ?? `employee-${sequence}@amdox.dev`,
      phone: overrides.phone ?? null,
      dateOfBirth: toDate(overrides.dateOfBirth),
      departmentId,
      managerId: overrides.managerId ?? null,
      designationId: overrides.designationId ?? null,
      status: overrides.status ?? "ACTIVE",
      hireDate: toDate(overrides.hireDate) ?? new Date("2026-01-01T00:00:00.000Z"),
      terminationDate: toDate(overrides.terminationDate),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.employees.push(record);
    return clone(record);
  };

  const ensureLeaveType = (overrides = {}) => {
    const record = {
      id: nextId("leave-type"),
      name: overrides.name ?? "Annual Leave",
      code: overrides.code ?? `AL-${sequence}`,
      accrualRate: toDecimal(overrides.accrualRate ?? "1.5"),
      maxBalance: toDecimal(overrides.maxBalance ?? "30"),
      carryForwardLimit: toDecimal(overrides.carryForwardLimit ?? "0"),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.leaveTypes.push(record);
    return clone(record);
  };

  const insertLeaveRequest = (overrides = {}) => {
    const employeeId =
      overrides.employeeId ?? state.employees[0]?.id ?? ensureEmployee().id;
    const leaveTypeId =
      overrides.leaveTypeId ?? state.leaveTypes[0]?.id ?? ensureLeaveType().id;
    const record = {
      id: nextId("leave-request"),
      employeeId,
      leaveTypeId,
      startDate: toDate(overrides.startDate) ?? new Date("2026-04-10T00:00:00.000Z"),
      endDate: toDate(overrides.endDate) ?? new Date("2026-04-12T00:00:00.000Z"),
      status: overrides.status ?? "APPROVED",
      reason: overrides.reason ?? null,
      submittedAt: toDate(overrides.submittedAt) ?? new Date("2026-04-01T00:00:00.000Z"),
      approvedBy: overrides.approvedBy ?? "hr-manager",
      approvedAt: toDate(overrides.approvedAt) ?? new Date("2026-04-02T00:00:00.000Z"),
      rejectedAt: null,
      cancelledAt: null,
      rejectionReason: null,
      cancelReason: null,
      systemReason: null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.leaveRequests.push(record);
    return clone(record);
  };

  const insertProject = (overrides = {}) => {
    const managerId =
      overrides.managerId ??
      state.employees[0]?.id ??
      ensureEmployee({
        userId: state.users[0]?.id ?? ensureUser({ role: "project_manager" }).id,
        status: "ACTIVE",
      }).id;
    const record = {
      id: nextId("project"),
      code: overrides.code ?? `PROJ-${sequence}`,
      name: overrides.name ?? `Project ${sequence}`,
      description: overrides.description ?? null,
      managerId,
      budget: BigInt(overrides.budget ?? 100000),
      actualCost: BigInt(overrides.actualCost ?? 75000),
      status: overrides.status ?? "ACTIVE",
      startDate: toDate(overrides.startDate) ?? new Date("2026-01-01T00:00:00.000Z"),
      endDate: toDate(overrides.endDate),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.projects.push(record);
    return clone(record);
  };

  const insertDashboard = (overrides = {}) => {
    const ownerId = overrides.ownerId ?? state.users[0]?.id ?? ensureUser().id;
    const record = {
      id: nextId("dashboard"),
      title: overrides.title ?? `Dashboard ${sequence}`,
      description: overrides.description ?? null,
      ownerId,
      isPublic: overrides.isPublic ?? false,
      layout: overrides.layout ?? null,
      defaultFilters: overrides.defaultFilters ?? null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.dashboards.push(record);
    return clone(record);
  };

  const insertWidget = (overrides = {}) => {
    const dashboardId =
      overrides.dashboardId ?? state.dashboards[0]?.id ?? insertDashboard().id;
    const record = {
      id: nextId("widget"),
      dashboardId,
      type: overrides.type ?? "BAR_CHART",
      title: overrides.title ?? "Revenue",
      metricKey: overrides.metricKey ?? "revenue_by_month",
      config: overrides.config ?? { filters: {} },
      position: overrides.position ?? { x: 0, y: 0, w: 4, h: 3 },
      refreshEnabled: overrides.refreshEnabled ?? true,
      sortOrder: overrides.sortOrder ?? 0,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.widgets.push(record);
    return clone(record);
  };

  const insertReportSchedule = (overrides = {}) => {
    const dashboardId =
      overrides.dashboardId ?? state.dashboards[0]?.id ?? insertDashboard().id;
    const record = {
      id: nextId("report-schedule"),
      dashboardId,
      title: overrides.title ?? "Weekly BI Report",
      cronExpression: overrides.cronExpression ?? "0 2 * * 1",
      timezone: overrides.timezone ?? "Asia/Calcutta",
      recipients: overrides.recipients ?? ["ops@amdox.dev"],
      formats: overrides.formats ?? ["PDF", "EXCEL"],
      isEnabled: overrides.isEnabled ?? true,
      lastRunAt: toDate(overrides.lastRunAt),
      nextRunAt: toDate(overrides.nextRunAt),
      createdById: overrides.createdById ?? state.users[0]?.id ?? ensureUser().id,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.reportSchedules.push(record);
    return clone(record);
  };

  const insertReportRun = (overrides = {}) => {
    const dashboardId =
      overrides.dashboardId ?? state.dashboards[0]?.id ?? insertDashboard().id;
    const record = {
      id: nextId("report-run"),
      reportScheduleId: overrides.reportScheduleId ?? null,
      dashboardId,
      status: overrides.status ?? "COMPLETED",
      startedAt: toDate(overrides.startedAt) ?? now(),
      completedAt: toDate(overrides.completedAt) ?? now(),
      snapshot: overrides.snapshot ?? null,
      artifact: overrides.artifact ?? null,
      deliveryStatus: overrides.deliveryStatus ?? "DELIVERED",
      failureReason: overrides.failureReason ?? null,
      triggeredBy: overrides.triggeredBy ?? "system",
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.reportRuns.push(record);
    return clone(record);
  };

  const insertNotification = (overrides = {}) => {
    const userId = overrides.userId ?? state.users[0]?.id ?? ensureUser().id;
    const record = {
      id: nextId("notification"),
      userId,
      type: overrides.type ?? "bi.report.ready",
      channel: overrides.channel ?? "IN_APP",
      title: overrides.title ?? "BI report ready",
      body: overrides.body ?? null,
      isRead: overrides.isRead ?? false,
      readAt: null,
      metadata: overrides.metadata ?? null,
      tenantId,
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
      id: nextId("outbox"),
      eventType: overrides.eventType ?? "bi.report.ready",
      payload: overrides.payload ?? {},
      status: overrides.status ?? "PENDING",
      processedAt: toDate(overrides.processedAt),
      retryCount: overrides.retryCount ?? 0,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.outboxEvents.push(record);
    return clone(record);
  };

  const attachDashboard = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.owner) {
      output.owner = clone(state.users.find((item) => item.id === record.ownerId) ?? null);
    }
    if (include?.widgets) {
      output.widgets = sortItems(
        state.widgets.filter((item) => item.dashboardId === record.id && !item.deletedAt),
        [{ sortOrder: "asc" }],
      ).map(clone);
    }
    return output;
  };

  const attachWidget = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.dashboard) {
      output.dashboard = clone(
        state.dashboards.find((item) => item.id === record.dashboardId) ?? null,
      );
    }
    return output;
  };

  const attachReportSchedule = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.dashboard) {
      output.dashboard = attachDashboard(
        state.dashboards.find((item) => item.id === record.dashboardId) ?? null,
        { owner: true, widgets: true },
      );
    }
    if (include?.runs) {
      output.runs = state.reportRuns
        .filter((item) => item.reportScheduleId === record.id)
        .map(clone);
    }
    return output;
  };

  const attachEmployee = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.department) {
      output.department = clone(
        state.departments.find((item) => item.id === record.departmentId) ?? null,
      );
    }
    return output;
  };

  Object.assign(base.prisma, {
    forTenant() {
      return base.prisma;
    },
    user: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(state.users.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.users.find((item) => matches(item, where)) ?? null);
      },
      async findUnique({ where = {} } = {}) {
        return clone(state.users.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return ensureUser(data);
      },
    },
    department: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(state.departments.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async create({ data }) {
        return ensureDepartment(data);
      },
    },
    employee: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(state.employees.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachEmployee(item, include),
        );
      },
      async create({ data, include } = {}) {
        return attachEmployee(ensureEmployee(data), include);
      },
    },
    leaveType: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(state.leaveTypes.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async create({ data }) {
        return ensureLeaveType(data);
      },
    },
    leaveRequest: {
      async findMany({ where = {}, include, orderBy } = {}) {
        let items = state.leaveRequests.filter((item) => matches(item, where));
        if (where?.employee?.departmentId) {
          items = items.filter((item) => {
            const employee = state.employees.find((entry) => entry.id === item.employeeId);
            return employee?.departmentId === where.employee.departmentId;
          });
        }
        return sortItems(items, orderBy).map((item) => {
          const output = clone(item);
          if (include?.employee) {
            output.employee = attachEmployee(
              state.employees.find((entry) => entry.id === item.employeeId) ?? null,
              { department: true },
            );
          }
          if (include?.leaveType) {
            output.leaveType = clone(
              state.leaveTypes.find((entry) => entry.id === item.leaveTypeId) ?? null,
            );
          }
          return output;
        });
      },
      async create({ data }) {
        return insertLeaveRequest(data);
      },
    },
    journalLine: {
      async findMany({ where = {}, include } = {}) {
        let items = [...state.journalLines];
        if (where.account?.type) {
          items = items.filter((line) => {
            const account = state.accounts.find((entry) => entry.id === line.accountId);
            return account?.type === where.account.type;
          });
        }
        if (where.journalEntry) {
          items = items.filter((line) => {
            const entry = state.journalEntries.find((record) => record.id === line.journalEntryId);
            if (!entry) return false;
            if (where.journalEntry.legalEntityId && entry.legalEntityId !== where.journalEntry.legalEntityId) {
              return false;
            }
            if (where.journalEntry.status && entry.status !== where.journalEntry.status) {
              return false;
            }
            if (where.journalEntry.date?.gte && entry.date < where.journalEntry.date.gte) {
              return false;
            }
            if (where.journalEntry.date?.lte && entry.date > where.journalEntry.date.lte) {
              return false;
            }
            return true;
          });
        }
        return items.map((line) => {
          const output = clone(line);
          if (include?.account) {
            output.account = clone(
              state.accounts.find((entry) => entry.id === line.accountId) ?? null,
            );
          }
          if (include?.journalEntry) {
            output.journalEntry = clone(
              state.journalEntries.find((entry) => entry.id === line.journalEntryId) ?? null,
            );
          }
          return output;
        });
      },
    },
    project: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(state.projects.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async create({ data }) {
        return insertProject(data);
      },
    },
    forecastPrediction: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.forecastPredictions.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => {
          const output = clone(item);
          if (include?.product) {
            output.product = clone(
              state.products.find((entry) => entry.id === item.productId) ?? null,
            );
          }
          return output;
        });
      },
      async create({ data }) {
        return base.prisma.forecastPrediction.create({ data });
      },
      async createMany({ data }) {
        return base.prisma.forecastPrediction.createMany({ data });
      },
      async deleteMany({ where } = {}) {
        return base.prisma.forecastPrediction.deleteMany({ where });
      },
    },
    dashboard: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(state.dashboards.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachDashboard(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachDashboard(
          state.dashboards.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        return attachDashboard(
          state.dashboards.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachDashboard(insertDashboard(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.dashboards.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachDashboard(record, include);
      },
    },
    widget: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(state.widgets.filter((item) => matches(item, where)), orderBy).map((item) =>
          attachWidget(item, include),
        );
      },
      async findFirst({ where = {}, include } = {}) {
        return attachWidget(state.widgets.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachWidget(insertWidget(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.widgets.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachWidget(record, include);
      },
      async delete({ where } = {}) {
        const record = state.widgets.find((item) => matches(item, where));
        record.deletedAt = now();
        return clone(record);
      },
    },
    reportSchedule: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.reportSchedules.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachReportSchedule(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachReportSchedule(
          state.reportSchedules.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        return attachReportSchedule(
          state.reportSchedules.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachReportSchedule(insertReportSchedule(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.reportSchedules.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachReportSchedule(record, include);
      },
    },
    reportRun: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(state.reportRuns.filter((item) => matches(item, where)), orderBy).map(clone);
      },
      async create({ data }) {
        return insertReportRun(data);
      },
      async update({ where, data } = {}) {
        const record = state.reportRuns.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
    },
    notification: {
      async create({ data }) {
        return insertNotification(data);
      },
      async createMany({ data }) {
        for (const entry of data) {
          insertNotification(entry);
        }
        return { count: data.length };
      },
    },
    outboxEvent: {
      async create({ data }) {
        return insertOutboxEvent(data);
      },
    },
  });

  return {
    ...base,
    state,
    insertUser: ensureUser,
    insertDepartment: ensureDepartment,
    insertEmployee: ensureEmployee,
    insertLeaveType: ensureLeaveType,
    insertLeaveRequest,
    insertProject,
    insertDashboard,
    insertWidget,
    insertReportSchedule,
    insertReportRun,
    insertNotification,
    insertOutboxEvent,
  };
}
