import { createRequire } from "node:module";
import { createBiHarness } from "./bi-test-store.mjs";

const require = createRequire(import.meta.url);
const { Prisma } = require("@amdox/db");

export function createNotificationsHarness(options = {}) {
  const base = createBiHarness(options);
  const state = base.state;
  const tenantId = options.tenantId ?? state.tenants[0]?.id ?? "tenant-1";

  Object.assign(state, {
    notificationPreferences: state.notificationPreferences ?? [],
    webhookConfigs: state.webhookConfigs ?? [],
    notificationTemplates: state.notificationTemplates ?? [],
    outboxEvents: state.outboxEvents ?? [],
    notifications: state.notifications ?? [],
    payrollRuns: state.payrollRuns ?? [],
  });

  let sequence = 1;
  const nextId = (prefix) => `notif-${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (value) => (value == null ? value : { ...value });
  const toDate = (value) =>
    value instanceof Date ? value : value ? new Date(value) : null;
  const toDecimal = (value, fallback = "0") =>
    value instanceof Prisma.Decimal
      ? value
      : new Prisma.Decimal(String(value ?? fallback));

  const matchesScalar = (actual, expected) => {
    if (expected === undefined) return true;
    if (expected instanceof Date) {
      return toDate(actual)?.getTime() === expected.getTime();
    }
    if (expected instanceof Prisma.Decimal) {
      return toDecimal(actual).equals(expected);
    }
    return actual === expected;
  };

  const matches = (item, where = {}) => {
    if (!where) return true;
    if (Array.isArray(where.AND)) {
      return where.AND.every((clause) => matches(item, clause));
    }
    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => matches(item, clause));
    }

    return Object.entries(where).every(([key, expected]) => {
      if (key === "AND" || key === "OR" || expected === undefined) {
        return true;
      }

      const actual = item[key];
      if (expected && typeof expected === "object" && !Array.isArray(expected)) {
        if (expected.in) {
          return expected.in.some((candidate) => matchesScalar(actual, candidate));
        }
        if (expected.not !== undefined) {
          return !matchesScalar(actual, expected.not);
        }
        if (expected.equals !== undefined) {
          return matchesScalar(actual, expected.equals);
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
        } else if (
          typeof leftValue === "number" ||
          typeof rightValue === "number"
        ) {
          result = Number(leftValue ?? 0) - Number(rightValue ?? 0);
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

  const insertNotificationPreference = (overrides = {}) => {
    const userId =
      overrides.userId ?? state.users[0]?.id ?? base.insertUser().id;
    const record = {
      id: nextId("preference"),
      userId,
      eventType: overrides.eventType ?? "invoice.match_failed",
      channel: overrides.channel ?? "EMAIL",
      enabled: overrides.enabled ?? true,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.notificationPreferences.push(record);
    return clone(record);
  };

  const insertWebhookConfig = (overrides = {}) => {
    const record = {
      id: nextId("webhook"),
      url: overrides.url ?? "https://example.com/webhooks/amdox",
      secret: overrides.secret ?? "webhook-secret",
      events: overrides.events ?? ["invoice.match_failed"],
      isActive: overrides.isActive ?? true,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.webhookConfigs.push(record);
    return clone(record);
  };

  const insertNotificationTemplate = (overrides = {}) => {
    const record = {
      id: nextId("template"),
      eventType: overrides.eventType ?? "invoice.match_failed",
      channel: overrides.channel ?? "EMAIL",
      subject: overrides.subject ?? "Invoice review required",
      body:
        overrides.body ??
        "Invoice {{invoiceId}} needs review because {{mismatchReasons}}.",
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.notificationTemplates.push(record);
    return clone(record);
  };

  const insertOutboxEvent = (overrides = {}) => {
    const record = {
      id: nextId("outbox"),
      eventType: overrides.eventType ?? "invoice.match_failed",
      payload: overrides.payload ?? {},
      status: overrides.status ?? "PENDING",
      processedAt: toDate(overrides.processedAt),
      retryCount: overrides.retryCount ?? 0,
      nextAttemptAt: toDate(overrides.nextAttemptAt),
      processingStartedAt: toDate(overrides.processingStartedAt),
      lastError: overrides.lastError ?? null,
      deliveryState: overrides.deliveryState ?? null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.outboxEvents.push(record);
    return clone(record);
  };

  const insertPayrollRun = (overrides = {}) => {
    const legalEntityId =
      overrides.legalEntityId ??
      state.legalEntities[0]?.id ??
      base.insertLegalEntity().id;
    const record = {
      id: nextId("payroll-run"),
      period: overrides.period ?? "2026-04",
      periodStart:
        toDate(overrides.periodStart) ?? new Date("2026-04-01T00:00:00.000Z"),
      periodEnd:
        toDate(overrides.periodEnd) ?? new Date("2026-04-30T00:00:00.000Z"),
      legalEntityId,
      status: overrides.status ?? "COMPLETED",
      processingStage: overrides.processingStage ?? "COMPLETED",
      failureReason: overrides.failureReason ?? null,
      attemptNumber: overrides.attemptNumber ?? 1,
      queuedAt: toDate(overrides.queuedAt),
      totalGross: BigInt(overrides.totalGross ?? 0),
      totalDeductions: BigInt(overrides.totalDeductions ?? 0),
      totalNet: BigInt(overrides.totalNet ?? 0),
      processedCount: overrides.processedCount ?? 0,
      totalCount: overrides.totalCount ?? 0,
      startedAt: toDate(overrides.startedAt),
      completedAt: toDate(overrides.completedAt),
      glJournalEntryId: overrides.glJournalEntryId ?? null,
      compensationJournalEntryId:
        overrides.compensationJournalEntryId ?? null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.payrollRuns.push(record);
    return clone(record);
  };

  const attachNotification = (record) => {
    if (!record) return null;
    return clone(record);
  };

  Object.assign(base.prisma, {
    forTenant() {
      return base.prisma;
    },
    employee: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(
          state.employees.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.employees.find((item) => matches(item, where)) ?? null);
      },
      async findUnique({ where = {} } = {}) {
        return clone(state.employees.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return base.insertEmployee(data);
      },
    },
    notification: {
      async create({ data }) {
        return base.insertNotification(data);
      },
      async createMany({ data }) {
        for (const entry of data) {
          base.insertNotification(entry);
        }
        return { count: data.length };
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        const items = sortItems(
          state.notifications.filter((item) => matches(item, where)),
          orderBy,
        ).map(attachNotification);
        return typeof take === "number" ? items.slice(0, take) : items;
      },
      async findFirst({ where = {} } = {}) {
        return attachNotification(
          state.notifications.find((item) => matches(item, where)) ?? null,
        );
      },
      async update({ where, data }) {
        const record = state.notifications.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachNotification(record);
      },
    },
    outboxEvent: {
      async create({ data }) {
        return insertOutboxEvent(data);
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        const items = sortItems(
          state.outboxEvents.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
        return typeof take === "number" ? items.slice(0, take) : items;
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.outboxEvents.find((item) => matches(item, where)) ?? null);
      },
      async findUnique({ where = {} } = {}) {
        return clone(state.outboxEvents.find((item) => matches(item, where)) ?? null);
      },
      async update({ where, data }) {
        const record = state.outboxEvents.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
      async updateMany({ where = {}, data }) {
        let count = 0;
        for (const record of state.outboxEvents) {
          if (matches(record, where)) {
            Object.assign(record, data, { updatedAt: now() });
            count += 1;
          }
        }
        return { count };
      },
    },
    notificationPreference: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(
          state.notificationPreferences.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
      },
      async upsert({ where, create, update }) {
        const record = state.notificationPreferences.find((item) => {
          if (where?.tenantId_userId_eventType_channel) {
            const composite = where.tenantId_userId_eventType_channel;
            return (
              item.tenantId === composite.tenantId &&
              item.userId === composite.userId &&
              item.eventType === composite.eventType &&
              item.channel === composite.channel
            );
          }
          return matches(item, where);
        });
        if (record) {
          Object.assign(record, update, { updatedAt: now() });
          return clone(record);
        }
        return insertNotificationPreference(create);
      },
    },
    webhookConfig: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(
          state.webhookConfigs.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.webhookConfigs.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertWebhookConfig(data);
      },
      async update({ where, data }) {
        const record = state.webhookConfigs.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
    },
    notificationTemplate: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(
          state.notificationTemplates.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(
          state.notificationTemplates.find((item) => matches(item, where)) ?? null,
        );
      },
      async upsert({ where, create, update }) {
        const record = state.notificationTemplates.find((item) => {
          if (where?.tenantId_eventType_channel) {
            const composite = where.tenantId_eventType_channel;
            return (
              item.tenantId === composite.tenantId &&
              item.eventType === composite.eventType &&
              item.channel === composite.channel
            );
          }
          return matches(item, where);
        });
        if (record) {
          Object.assign(record, update, { updatedAt: now() });
          return clone(record);
        }
        return insertNotificationTemplate(create);
      },
    },
    payrollRun: {
      async findFirst({ where = {} } = {}) {
        return clone(state.payrollRuns.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertPayrollRun(data);
      },
    },
  });

  return {
    ...base,
    state,
    insertNotificationPreference,
    insertWebhookConfig,
    insertNotificationTemplate,
    insertOutboxEvent,
    insertPayrollRun,
  };
}
