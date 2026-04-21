import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@amdox/db";
import {
  EmployeeStatus,
  MilestoneStatus,
  MilestoneTaskLinkException,
  ProjectManagerValidationException,
  ProjectStatus,
  ResourceUtilizationRow,
  TaskStatus,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { MilestoneQueryDto } from "./dto/milestone-query.dto";
import { ProjectUtilizationQueryDto } from "./dto/project-utilization-query.dto";
import { serializeProjectManagementValue } from "./project-management.serialization";
import { ProjectDependencyService } from "./project-dependency.service";
import { ProjectBudgetAlertService } from "./project-budget-alert.service";

const HOURS_PER_DAY = 8;
type TenantPrisma = ReturnType<PrismaService["forTenant"]>;

@Injectable()
export class ProjectManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly dependencyService: ProjectDependencyService,
    private readonly budgetAlertService: ProjectBudgetAlertService,
  ) {}

  async createProject(dto: CreateProjectDto) {
    const tenantId = this.requireTenantId();
    const manager = await this.ensureActiveEmployee(dto.managerId);

    return serializeProjectManagementValue(
      await this.prisma.tenant.project.create({
        data: {
          tenantId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          managerId: manager.id,
          budget: BigInt(Math.trunc(dto.budget)),
          actualCost: BigInt(Math.trunc(dto.actualCost ?? 0)),
          status: dto.status ?? ProjectStatus.PLANNING,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        include: this.projectInclude(),
      }),
    );
  }

  async listProjects(query: ProjectQueryDto) {
    return serializeProjectManagementValue(
      await this.prisma.tenant.project.findMany({
        where: {
          deletedAt: null,
          status: query.status,
          managerId: query.managerId,
        },
        include: this.projectInclude(),
        orderBy: [{ updatedAt: "desc" }],
      }),
    );
  }

  async getProject(id: string) {
    return serializeProjectManagementValue(
      await this.getProjectRecord(id, this.projectInclude()),
    );
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    const existing = await this.getProjectRecord(id, this.projectInclude());
    const manager =
      dto.managerId === undefined
        ? existing.manager
        : await this.ensureActiveEmployee(dto.managerId);

    return serializeProjectManagementValue(
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.project.update({
          where: { id },
          data: {
            code: dto.code?.trim().toUpperCase() ?? existing.code,
            name: dto.name?.trim() ?? existing.name,
            description:
              dto.description === undefined
                ? existing.description
                : (dto.description?.trim() ?? null),
            managerId: manager.id,
            budget:
              dto.budget === undefined
                ? existing.budget
                : BigInt(Math.trunc(dto.budget)),
            actualCost:
              dto.actualCost === undefined
                ? existing.actualCost
                : BigInt(Math.trunc(dto.actualCost)),
            status: dto.status ?? existing.status,
            startDate:
              dto.startDate === undefined
                ? existing.startDate
                : dto.startDate
                  ? new Date(dto.startDate)
                  : null,
            endDate:
              dto.endDate === undefined
                ? existing.endDate
                : dto.endDate
                  ? new Date(dto.endDate)
                  : null,
          },
          include: this.projectInclude(),
        });

        await this.budgetAlertService.handleBudgetThresholdCrossing(tx, {
          previous: existing,
          current: updated,
        });

        return updated;
      }),
    );
  }

  async createTask(dto: CreateTaskDto) {
    const tenantId = this.requireTenantId();
    await this.ensureProjectExists(dto.projectId);
    if (dto.assigneeId) {
      await this.ensureEmployeeExists(dto.assigneeId);
    }
    if (dto.milestoneId) {
      await this.ensureMilestoneBelongsToProject(
        dto.milestoneId,
        dto.projectId,
      );
    }

    return serializeProjectManagementValue(
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            tenantId,
            projectId: dto.projectId,
            milestoneId: dto.milestoneId ?? null,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? null,
            assigneeId: dto.assigneeId ?? null,
            status: dto.status ?? TaskStatus.TODO,
            priority: dto.priority ?? "MEDIUM",
            estimatedHours:
              dto.estimatedHours == null
                ? null
                : new Prisma.Decimal(String(dto.estimatedHours)),
            actualHours: new Prisma.Decimal(String(dto.actualHours ?? 0)),
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            completedAt:
              (dto.status ?? TaskStatus.TODO) === TaskStatus.DONE
                ? new Date()
                : null,
          },
          include: this.taskInclude(),
        });

        if (created.milestoneId) {
          await this.recomputeMilestoneStatus(tx, created.milestoneId);
        }

        return created;
      }),
    );
  }

  async listTasks(query: TaskQueryDto) {
    return serializeProjectManagementValue(
      await this.prisma.tenant.task.findMany({
        where: {
          deletedAt: null,
          projectId: query.projectId,
          assigneeId: query.assigneeId,
          milestoneId: query.milestoneId,
          status: query.status,
        },
        include: this.taskInclude(),
        orderBy: [{ updatedAt: "desc" }],
      }),
    );
  }

  async getTask(id: string) {
    return serializeProjectManagementValue(
      await this.getTaskRecord(id, this.taskInclude()),
    );
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const existing = await this.getTaskRecord(id, this.taskInclude());

    if (dto.assigneeId) {
      await this.ensureEmployeeExists(dto.assigneeId);
    }

    const milestoneId =
      dto.milestoneId === undefined
        ? existing.milestoneId
        : (dto.milestoneId ?? null);
    if (milestoneId) {
      await this.ensureMilestoneBelongsToProject(
        milestoneId,
        existing.projectId,
      );
    }

    return serializeProjectManagementValue(
      await this.prisma.$transaction(async (tx) => {
        const nextStatus = dto.status ?? existing.status;
        const updated = await tx.task.update({
          where: { id },
          data: {
            milestoneId,
            name: dto.name?.trim() ?? existing.name,
            description:
              dto.description === undefined
                ? existing.description
                : (dto.description?.trim() ?? null),
            assigneeId:
              dto.assigneeId === undefined
                ? existing.assigneeId
                : (dto.assigneeId ?? null),
            status: nextStatus,
            priority: dto.priority ?? existing.priority,
            estimatedHours:
              dto.estimatedHours === undefined
                ? existing.estimatedHours
                : dto.estimatedHours == null
                  ? null
                  : new Prisma.Decimal(String(dto.estimatedHours)),
            actualHours:
              dto.actualHours === undefined
                ? existing.actualHours
                : new Prisma.Decimal(String(dto.actualHours)),
            startDate:
              dto.startDate === undefined
                ? existing.startDate
                : dto.startDate
                  ? new Date(dto.startDate)
                  : null,
            dueDate:
              dto.dueDate === undefined
                ? existing.dueDate
                : dto.dueDate
                  ? new Date(dto.dueDate)
                  : null,
            completedAt:
              nextStatus === TaskStatus.DONE
                ? (existing.completedAt ?? new Date())
                : null,
          },
          include: this.taskInclude(),
        });

        const milestoneIds = new Set<string>();
        if (existing.milestoneId) {
          milestoneIds.add(existing.milestoneId);
        }
        if (updated.milestoneId) {
          milestoneIds.add(updated.milestoneId);
        }
        for (const taskMilestoneId of milestoneIds) {
          await this.recomputeMilestoneStatus(tx, taskMilestoneId);
        }

        return updated;
      }),
    );
  }

  async createMilestone(dto: CreateMilestoneDto) {
    const tenantId = this.requireTenantId();
    await this.ensureProjectExists(dto.projectId);

    return serializeProjectManagementValue(
      await this.prisma.tenant.projectMilestone.create({
        data: {
          tenantId,
          projectId: dto.projectId,
          name: dto.name.trim(),
          dueDate: new Date(dto.dueDate),
          status: MilestoneStatus.PENDING,
        },
        include: this.milestoneInclude(),
      }),
    );
  }

  async listMilestones(query: MilestoneQueryDto) {
    return serializeProjectManagementValue(
      await this.prisma.tenant.projectMilestone.findMany({
        where: {
          deletedAt: null,
          projectId: query.projectId,
        },
        include: this.milestoneInclude(),
        orderBy: [{ dueDate: "asc" }],
      }),
    );
  }

  async getMilestone(id: string) {
    return serializeProjectManagementValue(
      await this.getMilestoneRecord(id, this.milestoneInclude()),
    );
  }

  async updateMilestone(id: string, dto: UpdateMilestoneDto) {
    const existing = await this.getMilestoneRecord(id, this.milestoneInclude());

    return serializeProjectManagementValue(
      await this.prisma.tenant.projectMilestone.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? existing.name,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
        },
        include: this.milestoneInclude(),
      }),
    );
  }

  async createTaskDependency(dto: {
    taskId: string;
    dependsOnTaskId: string;
    type: string;
  }) {
    const tenantId = this.requireTenantId();
    return serializeProjectManagementValue(
      await this.dependencyService.createDependency(
        this.prisma.tenant,
        tenantId,
        dto,
      ),
    );
  }

  async deleteTaskDependency(id: string) {
    const tenantId = this.requireTenantId();
    return serializeProjectManagementValue(
      await this.dependencyService.deleteDependency(
        this.prisma.tenant,
        id,
        tenantId,
      ),
    );
  }

  async listTaskDependencies(taskId?: string) {
    return serializeProjectManagementValue(
      await this.prisma.tenant.taskDependency.findMany({
        where: {
          deletedAt: null,
          taskId,
        },
        include: {
          task: true,
          dependsOn: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
    );
  }

  async getUtilization(query: ProjectUtilizationQueryDto) {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (endDate < startDate) {
      throw new BadRequestException("End date must be on or after start date.");
    }

    const employees = await this.prisma.tenant.employee.findMany({
      where: {
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
        id: query.employeeId,
      },
      orderBy: [{ employeeCode: "asc" }],
    });

    const tasks = await this.prisma.tenant.task.findMany({
      where: {
        deletedAt: null,
        assigneeId: query.employeeId,
        projectId: query.projectId,
        status: { not: TaskStatus.DONE },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const approvedLeave = await this.prisma.tenant.leaveRequest.findMany({
      where: {
        deletedAt: null,
        employeeId: query.employeeId,
        status: "APPROVED",
      },
      orderBy: [{ startDate: "asc" }],
    });

    const rows: ResourceUtilizationRow[] = employees.map((employee) => {
      const employeeTasks = tasks.filter(
        (task) => task.assigneeId === employee.id,
      );
      const allocatedHours = employeeTasks.reduce(
        (total, task) => total + Number(task.estimatedHours?.toString() ?? "0"),
        0,
      );
      const leaveDays = approvedLeave
        .filter((request) => request.employeeId === employee.id)
        .reduce(
          (total, request) =>
            total +
            this.getBusinessDayOverlapCount(
              startDate,
              endDate,
              request.startDate,
              request.endDate,
            ),
          0,
        );
      const availableHours = Math.max(
        this.getBusinessDayCount(startDate, endDate) * HOURS_PER_DAY -
          leaveDays * HOURS_PER_DAY,
        0,
      );

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        allocatedHours,
        availableHours,
        utilizationPercent:
          availableHours === 0
            ? 0
            : Number(((allocatedHours / availableHours) * 100).toFixed(2)),
      };
    });

    return serializeProjectManagementValue(rows);
  }

  private async recomputeMilestoneStatus(
    db: TenantPrisma,
    milestoneId: string,
  ) {
    const milestone = await db.projectMilestone.findFirst({
      where: { id: milestoneId, deletedAt: null },
    });
    if (!milestone) {
      return null;
    }

    const tasks = await db.task.findMany({
      where: {
        milestoneId,
        deletedAt: null,
      },
    });

    const completed =
      tasks.length > 0 &&
      tasks.every(
        (task: { status: string }) => task.status === TaskStatus.DONE,
      );
    return db.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        status: completed ? MilestoneStatus.COMPLETED : MilestoneStatus.PENDING,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  private async getProjectRecord(
    id: string,
    include?: Record<string, unknown>,
  ) {
    const project = await this.prisma.tenant.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });
    if (!project) {
      throw new NotFoundException("Project not found.");
    }
    return project;
  }

  private async getTaskRecord(id: string, include?: Record<string, unknown>) {
    const task = await this.prisma.tenant.task.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }
    return task;
  }

  private async getMilestoneRecord(
    id: string,
    include?: Record<string, unknown>,
  ) {
    const milestone = await this.prisma.tenant.projectMilestone.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include,
    });
    if (!milestone) {
      throw new NotFoundException("Project milestone not found.");
    }
    return milestone;
  }

  private async ensureActiveEmployee(employeeId: string) {
    const employee = await this.prisma.tenant.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
      },
    });
    if (!employee || employee.status !== EmployeeStatus.ACTIVE) {
      throw new ProjectManagerValidationException();
    }
    return employee;
  }

  private async ensureEmployeeExists(employeeId: string) {
    const employee = await this.prisma.tenant.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
      },
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }
    return employee;
  }

  private async ensureProjectExists(projectId: string) {
    const project = await this.prisma.tenant.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
    });
    if (!project) {
      throw new NotFoundException("Project not found.");
    }
    return project;
  }

  private async ensureMilestoneBelongsToProject(
    milestoneId: string,
    projectId: string,
  ) {
    const milestone = await this.prisma.tenant.projectMilestone.findFirst({
      where: {
        id: milestoneId,
        deletedAt: null,
      },
    });
    if (!milestone || milestone.projectId !== projectId) {
      throw new MilestoneTaskLinkException();
    }
    return milestone;
  }

  private getBusinessDayCount(startDate: Date, endDate: Date) {
    let count = 0;
    const cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
      ),
    );
    const end = new Date(
      Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate(),
      ),
    );

    while (cursor <= end) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return count;
  }

  private getBusinessDayOverlapCount(
    rangeStart: Date,
    rangeEnd: Date,
    leaveStart: Date,
    leaveEnd: Date,
  ) {
    const start = new Date(
      Math.max(rangeStart.getTime(), leaveStart.getTime()),
    );
    const end = new Date(Math.min(rangeEnd.getTime(), leaveEnd.getTime()));
    if (end < start) {
      return 0;
    }
    return this.getBusinessDayCount(start, end);
  }

  private projectInclude() {
    return {
      manager: true,
      milestones: {
        where: { deletedAt: null },
        orderBy: [{ dueDate: "asc" }],
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }],
      },
    };
  }

  private taskInclude() {
    return {
      project: true,
      assignee: true,
      milestone: true,
      dependencies: {
        where: { deletedAt: null },
        include: {
          dependsOn: true,
        },
      },
      dependents: {
        where: { deletedAt: null },
        include: {
          task: true,
        },
      },
    };
  }

  private milestoneInclude() {
    return {
      project: true,
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "asc" }],
      },
    };
  }

  private requireTenantId() {
    const tenantId = this.cls.get<string>("tenantId");
    if (!tenantId || tenantId === "*") {
      throw new ForbiddenException(
        "Project management endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }
}
