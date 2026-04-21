import { createRequire } from "node:module";
import { createForecastHarness } from "./forecast-test-store.mjs";

const require = createRequire(import.meta.url);
const { Prisma } = require("@amdox/db");

export function createProjectManagementHarness(options = {}) {
  const base = createForecastHarness(options);
  const state = base.state;
  const tenantId = options.tenantId ?? state.tenants[0]?.id ?? "tenant-1";

  Object.assign(state, {
    departments: state.departments ?? [],
    employees: state.employees ?? [],
    leaveTypes: state.leaveTypes ?? [],
    leaveRequests: state.leaveRequests ?? [],
    projects: state.projects ?? [],
    tasks: state.tasks ?? [],
    taskDependencies: state.taskDependencies ?? [],
    projectMilestones: state.projectMilestones ?? [],
    users: state.users ?? [],
    notifications: state.notifications ?? [],
    outboxEvents: state.outboxEvents ?? [],
  });

  let sequence = 1;
  const nextId = (prefix) => `pm-${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (value) => (value == null ? value : { ...value });
  const toDecimal = (value, fallback = "0") =>
    value instanceof Prisma.Decimal
      ? value
      : new Prisma.Decimal(String(value ?? fallback));
  const toDate = (value) =>
    value instanceof Date ? value : value ? new Date(value) : null;

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

  const ensureUser = (overrides = {}) => {
    const record = {
      id: nextId("user"),
      email: overrides.email ?? `pm-user-${sequence}@amdox.dev`,
      firstName: overrides.firstName ?? "Project",
      lastName: overrides.lastName ?? "User",
      keycloakId: overrides.keycloakId ?? `pm-keycloak-${sequence}`,
      tenantId,
      role: overrides.role ?? "project_manager",
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
      firstName: overrides.firstName ?? "Project",
      lastName: overrides.lastName ?? `Employee ${sequence}`,
      email: overrides.email ?? `employee-${sequence}@amdox.dev`,
      phone: overrides.phone ?? null,
      dateOfBirth: toDate(overrides.dateOfBirth),
      hireDate: toDate(overrides.hireDate) ?? new Date("2026-01-01T00:00:00.000Z"),
      terminationDate: toDate(overrides.terminationDate),
      status: overrides.status ?? "ACTIVE",
      departmentId,
      designationId: overrides.designationId ?? null,
      managerId: overrides.managerId ?? null,
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
      rejectedAt: toDate(overrides.rejectedAt),
      cancelledAt: toDate(overrides.cancelledAt),
      rejectionReason: overrides.rejectionReason ?? null,
      cancelReason: overrides.cancelReason ?? null,
      systemReason: overrides.systemReason ?? null,
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.leaveRequests.push(record);
    return clone(record);
  };

  const ensureProjectManagerId = (overrides = {}) => {
    if (overrides.managerId) {
      return overrides.managerId;
    }
    if (state.employees[0]?.id) {
      return state.employees[0].id;
    }

    const user = state.users[0] ?? ensureUser();
    return ensureEmployee({
      userId: user.id,
      status: "ACTIVE",
    }).id;
  };

  const insertProject = (overrides = {}) => {
    const managerId = ensureProjectManagerId(overrides);
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

  const insertProjectMilestone = (overrides = {}) => {
    const projectId =
      overrides.projectId ?? state.projects[0]?.id ?? insertProject().id;
    const record = {
      id: nextId("milestone"),
      projectId,
      name: overrides.name ?? `Milestone ${sequence}`,
      dueDate: toDate(overrides.dueDate) ?? new Date("2026-06-01T00:00:00.000Z"),
      status: overrides.status ?? "PENDING",
      completedAt: toDate(overrides.completedAt),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.projectMilestones.push(record);
    return clone(record);
  };

  const insertTask = (overrides = {}) => {
    const projectId =
      overrides.projectId ?? state.projects[0]?.id ?? insertProject().id;
    const record = {
      id: nextId("task"),
      projectId,
      milestoneId: overrides.milestoneId ?? null,
      name: overrides.name ?? `Task ${sequence}`,
      description: overrides.description ?? null,
      assigneeId: overrides.assigneeId ?? null,
      status: overrides.status ?? "TODO",
      priority: overrides.priority ?? "MEDIUM",
      estimatedHours:
        overrides.estimatedHours == null
          ? null
          : toDecimal(overrides.estimatedHours),
      actualHours: toDecimal(overrides.actualHours ?? "0"),
      startDate: toDate(overrides.startDate),
      dueDate: toDate(overrides.dueDate),
      completedAt: toDate(overrides.completedAt),
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    if (record.estimatedHours != null) {
      record.estimatedHours = toDecimal(record.estimatedHours);
    }
    record.actualHours = toDecimal(record.actualHours);
    state.tasks.push(record);
    return clone(record);
  };

  const insertTaskDependency = (overrides = {}) => {
    const taskId = overrides.taskId ?? state.tasks[0]?.id ?? insertTask().id;
    const dependsOnTaskId =
      overrides.dependsOnTaskId ??
      state.tasks.find((task) => task.id !== taskId)?.id ??
      insertTask().id;
    const record = {
      id: nextId("dependency"),
      taskId,
      dependsOnTaskId,
      type: overrides.type ?? "FINISH_TO_START",
      tenantId,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.taskDependencies.push(record);
    return clone(record);
  };

  const insertNotification = (overrides = {}) => {
    const userId = overrides.userId ?? state.users[0]?.id ?? ensureUser().id;
    const record = {
      id: nextId("notification"),
      userId,
      type: overrides.type ?? "project.budget.overrun",
      channel: overrides.channel ?? "IN_APP",
      title: overrides.title ?? "Project budget alert",
      body: overrides.body ?? null,
      isRead: overrides.isRead ?? false,
      readAt: toDate(overrides.readAt),
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
      eventType: overrides.eventType ?? "project.budget.overrun",
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

  const attachEmployee = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.department) {
      output.department = clone(
        state.departments.find((item) => item.id === record.departmentId) ?? null,
      );
    }
    if (include?.manager) {
      output.manager = attachEmployee(
        state.employees.find((item) => item.id === record.managerId) ?? null,
        include.manager.include,
      );
    }
    if (include?.managedProjects) {
      output.managedProjects = state.projects
        .filter((item) => item.managerId === record.id && item.deletedAt == null)
        .map((item) => attachProject(item, include.managedProjects.include));
    }
    return output;
  };

  const attachProject = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.manager) {
      output.manager = attachEmployee(
        state.employees.find((item) => item.id === record.managerId) ?? null,
        include.manager.include,
      );
    }
    if (include?.tasks) {
      output.tasks = sortItems(
        state.tasks.filter((item) => item.projectId === record.id && item.deletedAt == null),
        include.tasks.orderBy,
      ).map((item) => attachTask(item, include.tasks.include));
    }
    if (include?.milestones) {
      output.milestones = sortItems(
        state.projectMilestones.filter(
          (item) => item.projectId === record.id && item.deletedAt == null,
        ),
        include.milestones.orderBy,
      ).map((item) => attachProjectMilestone(item, include.milestones.include));
    }
    return output;
  };

  const attachProjectMilestone = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.project) {
      output.project = attachProject(
        state.projects.find((item) => item.id === record.projectId) ?? null,
        include.project.include,
      );
    }
    if (include?.tasks) {
      output.tasks = sortItems(
        state.tasks.filter((item) => item.milestoneId === record.id && item.deletedAt == null),
        include.tasks.orderBy,
      ).map((item) => attachTask(item, include.tasks.include));
    }
    return output;
  };

  const attachTaskDependency = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.task) {
      output.task = attachTask(
        state.tasks.find((item) => item.id === record.taskId) ?? null,
        include.task.include,
      );
    }
    if (include?.dependsOn) {
      output.dependsOn = attachTask(
        state.tasks.find((item) => item.id === record.dependsOnTaskId) ?? null,
        include.dependsOn.include,
      );
    }
    return output;
  };

  const attachTask = (record, include) => {
    if (!record) return null;
    const output = clone(record);
    if (include?.project) {
      output.project = attachProject(
        state.projects.find((item) => item.id === record.projectId) ?? null,
        include.project.include,
      );
    }
    if (include?.assignee) {
      output.assignee = attachEmployee(
        state.employees.find((item) => item.id === record.assigneeId) ?? null,
        include.assignee.include,
      );
    }
    if (include?.milestone) {
      output.milestone = attachProjectMilestone(
        state.projectMilestones.find((item) => item.id === record.milestoneId) ?? null,
        include.milestone.include,
      );
    }
    if (include?.dependencies) {
      output.dependencies = state.taskDependencies
        .filter((item) => item.taskId === record.id && item.deletedAt == null)
        .map((item) => attachTaskDependency(item, include.dependencies.include));
    }
    if (include?.dependents) {
      output.dependents = state.taskDependencies
        .filter((item) => item.dependsOnTaskId === record.id && item.deletedAt == null)
        .map((item) => attachTaskDependency(item, include.dependents.include));
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
        return sortItems(
          state.departments.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
      },
      async create({ data }) {
        return ensureDepartment(data);
      },
    },
    employee: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.employees.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachEmployee(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachEmployee(
          state.employees.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        return attachEmployee(
          state.employees.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachEmployee(ensureEmployee(data), include);
      },
    },
    leaveType: {
      async findMany({ where = {}, orderBy } = {}) {
        return sortItems(
          state.leaveTypes.filter((item) => matches(item, where)),
          orderBy,
        ).map(clone);
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
              include.employee.include,
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
    project: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.projects.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachProject(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachProject(
          state.projects.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        return attachProject(
          state.projects.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachProject(insertProject(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.projects.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachProject(record, include);
      },
    },
    projectMilestone: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.projectMilestones.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachProjectMilestone(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachProjectMilestone(
          state.projectMilestones.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        return attachProjectMilestone(
          state.projectMilestones.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachProjectMilestone(insertProjectMilestone(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.projectMilestones.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachProjectMilestone(record, include);
      },
    },
    task: {
      async findMany({ where = {}, include, orderBy } = {}) {
        let items = state.tasks.filter((item) => matches(item, where));
        if (where?.project?.managerId) {
          items = items.filter((item) => {
            const project = state.projects.find((entry) => entry.id === item.projectId);
            return project?.managerId === where.project.managerId;
          });
        }
        return sortItems(items, orderBy).map((item) => attachTask(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        let item = state.tasks.find((entry) => matches(entry, where)) ?? null;
        if (where?.project?.managerId) {
          item =
            state.tasks.find((entry) => {
              const project = state.projects.find((projectItem) => projectItem.id === entry.projectId);
              return matches(entry, where) && project?.managerId === where.project.managerId;
            }) ?? null;
        }
        return attachTask(item, include);
      },
      async findUnique({ where = {}, include } = {}) {
        return attachTask(
          state.tasks.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachTask(insertTask(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.tasks.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        if (record.estimatedHours != null) {
          record.estimatedHours = toDecimal(record.estimatedHours);
        }
        record.actualHours = toDecimal(record.actualHours);
        return attachTask(record, include);
      },
    },
    taskDependency: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return sortItems(
          state.taskDependencies.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachTaskDependency(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachTaskDependency(
          state.taskDependencies.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        if (where.taskId_dependsOnTaskId) {
          return attachTaskDependency(
            state.taskDependencies.find(
              (item) =>
                item.taskId === where.taskId_dependsOnTaskId.taskId &&
                item.dependsOnTaskId === where.taskId_dependsOnTaskId.dependsOnTaskId,
            ) ?? null,
            include,
          );
        }
        return attachTaskDependency(
          state.taskDependencies.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachTaskDependency(insertTaskDependency(data), include);
      },
      async delete({ where } = {}) {
        const index = state.taskDependencies.findIndex((item) => matches(item, where));
        if (index === -1) {
          return null;
        }
        const [record] = state.taskDependencies.splice(index, 1);
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
      async findMany({ where = {} } = {}) {
        return state.notifications.filter((item) => matches(item, where)).map(clone);
      },
    },
    outboxEvent: {
      async create({ data }) {
        return insertOutboxEvent(data);
      },
      async findMany({ where = {} } = {}) {
        return state.outboxEvents.filter((item) => matches(item, where)).map(clone);
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
    insertProjectMilestone,
    insertTask,
    insertTaskDependency,
    insertNotification,
    insertOutboxEvent,
  };
}
