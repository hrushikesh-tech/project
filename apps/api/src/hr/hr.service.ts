import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificationChannel, Prisma } from "@amdox/db";
import {
  AttendanceCorrectionException,
  DepartmentHeadValidationException,
  EmployeeLifecycleException,
  EmployeeStatus,
  InsufficientLeaveBalanceException,
  InvalidLeaveTransitionException,
  LeaveStatus,
  UserRole,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { AttendanceActionDto } from "./dto/attendance-action.dto";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { HrQueryDto } from "./dto/hr-query.dto";
import { ReviewLeaveRequestDto } from "./dto/review-leave-request.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { serializeHrValue } from "./hr.serialization";

type RequestActor =
  | {
      userId: string;
      roles?: string[];
    }
  | undefined;

type OrgChartRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  managerId: string | null;
  depth: number;
};

type DepartmentTreeRow = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  headId: string | null;
  depth: number;
};

type HrTransaction = Prisma.TransactionClient;
type EmployeeWithManager = Prisma.EmployeeGetPayload<{
  include: {
    manager: true;
  };
}>;
type LeaveRequestWithManager = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: {
      include: {
        manager: true;
      };
    };
    leaveType: true;
  };
}>;
type AttendanceWithEmployeeManager = Prisma.AttendanceGetPayload<{
  include: {
    employee: {
      include: {
        manager: true;
      };
    };
  };
}>;

const HOURS_PER_DAY = new Prisma.Decimal("8");
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const MILLIS_PER_HOUR = new Prisma.Decimal("3600000");
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async createEmployee(dto: CreateEmployeeDto) {
    const tenantId = this.requireTenantId();
    await this.ensureDepartmentExists(dto.departmentId);
    if (dto.managerId) {
      await this.ensureEmployeeExists(dto.managerId);
    }

    const hireDate = new Date(dto.hireDate);
    const terminationDate = dto.terminationDate
      ? new Date(dto.terminationDate)
      : null;

    return serializeHrValue(
      await this.prisma.tenant.employee.create({
        data: {
          tenantId,
          employeeCode: dto.employeeCode.trim().toUpperCase(),
          userId: dto.userId ?? null,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone?.trim() ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          hireDate,
          terminationDate,
          departmentId: dto.departmentId,
          designationId: dto.designationId ?? null,
          managerId: dto.managerId ?? null,
          status: this.resolveLifecycleStatus(hireDate, terminationDate),
        },
        include: {
          department: true,
          manager: true,
        },
      }),
    );
  }

  async listEmployees(query: HrQueryDto) {
    const now = new Date();
    const employees = await this.prisma.tenant.employee.findMany({
      where: {
        deletedAt: null,
        departmentId: query.departmentId,
        managerId: query.managerId,
      },
      include: {
        department: true,
        manager: true,
      },
      orderBy: [{ employeeCode: "asc" }],
    });

    const filtered = query.activeRoster
      ? employees.filter(
          (employee) =>
            employee.hireDate <= now &&
            (employee.terminationDate == null ||
              employee.terminationDate > now),
        )
      : employees;

    return serializeHrValue(filtered);
  }

  async getEmployee(id: string) {
    const employee = await this.getEmployeeRecord(id, {
      reports: true,
    });
    return serializeHrValue(employee);
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.getEmployeeRecord(id);
    const isEffectivelyTerminated =
      employee.status === EmployeeStatus.TERMINATED ||
      (employee.terminationDate instanceof Date &&
        employee.terminationDate <= new Date());

    if (
      isEffectivelyTerminated &&
      (dto.departmentId !== undefined ||
        dto.managerId !== undefined ||
        dto.hireDate !== undefined ||
        dto.terminationDate !== undefined)
    ) {
      throw new EmployeeLifecycleException(
        "Department, manager, hire date, and termination date cannot change after termination takes effect.",
      );
    }

    if (dto.departmentId) {
      await this.ensureDepartmentExists(dto.departmentId);
    }
    if (dto.managerId) {
      await this.ensureEmployeeExists(dto.managerId);
    }

    const hireDate = dto.hireDate ? new Date(dto.hireDate) : employee.hireDate;
    const terminationDate =
      dto.terminationDate === undefined
        ? employee.terminationDate
        : dto.terminationDate
          ? new Date(dto.terminationDate)
          : null;

    return serializeHrValue(
      await this.prisma.tenant.employee.update({
        where: { id },
        data: {
          userId: dto.userId ?? employee.userId,
          firstName: dto.firstName?.trim() ?? employee.firstName,
          lastName: dto.lastName?.trim() ?? employee.lastName,
          email: dto.email?.trim().toLowerCase() ?? employee.email,
          phone:
            dto.phone === undefined
              ? employee.phone
              : (dto.phone?.trim() ?? null),
          dateOfBirth:
            dto.dateOfBirth === undefined
              ? employee.dateOfBirth
              : dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : null,
          hireDate,
          terminationDate,
          departmentId: dto.departmentId ?? employee.departmentId,
          designationId:
            dto.designationId === undefined
              ? employee.designationId
              : (dto.designationId ?? null),
          managerId:
            dto.managerId === undefined
              ? employee.managerId
              : (dto.managerId ?? null),
          status: this.resolveLifecycleStatus(hireDate, terminationDate),
        },
        include: {
          department: true,
          manager: true,
        },
      }),
    );
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const tenantId = this.requireTenantId();
    if (dto.parentId) {
      await this.ensureDepartmentExists(dto.parentId);
    }

    return serializeHrValue(
      await this.prisma.$transaction(async (tx) => {
        const department = await tx.department.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            parentId: dto.parentId ?? null,
          },
        });

        if (dto.headId) {
          await this.assertDepartmentHead(tx, dto.headId, department.id);
          await tx.department.update({
            where: { id: department.id },
            data: { headId: dto.headId },
          });
        }

        return tx.department.findFirst({
          where: { id: department.id },
          include: {
            parent: true,
            children: true,
            head: true,
          },
        });
      }),
    );
  }

  async listDepartments() {
    return serializeHrValue(
      await this.prisma.tenant.department.findMany({
        where: { deletedAt: null },
        include: {
          parent: true,
          children: true,
          head: true,
        },
        orderBy: [{ code: "asc" }],
      }),
    );
  }

  async getDepartment(id: string) {
    const department = await this.prisma.tenant.department.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        parent: true,
        children: true,
        head: true,
        employees: true,
      },
    });
    if (!department) {
      throw new NotFoundException("Department not found.");
    }
    return serializeHrValue(department);
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const current = await this.prisma.tenant.department.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) {
      throw new NotFoundException("Department not found.");
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("Department cannot be its own parent.");
      }
      await this.ensureDepartmentExists(dto.parentId);
    }

    return serializeHrValue(
      await this.prisma.$transaction(async (tx) => {
        const targetHeadId =
          dto.headId === undefined ? current.headId : (dto.headId ?? null);
        if (targetHeadId) {
          await this.assertDepartmentHead(tx, targetHeadId, id);
        }

        return tx.department.update({
          where: { id },
          data: {
            name: dto.name?.trim() ?? current.name,
            code: dto.code?.trim().toUpperCase() ?? current.code,
            parentId:
              dto.parentId === undefined
                ? current.parentId
                : (dto.parentId ?? null),
            headId: targetHeadId,
          },
          include: {
            parent: true,
            children: true,
            head: true,
          },
        });
      }),
    );
  }

  async getOrgChart(rootEmployeeId?: string) {
    const tenantId = this.requireTenantId();
    const params = [tenantId];
    let anchorClause = `e."managerId" IS NULL`;

    if (rootEmployeeId) {
      params.push(rootEmployeeId);
      anchorClause = 'e."id" = $2';
    }

    const rows = await this.prisma.raw.$queryRawUnsafe<OrgChartRow[]>(
      `
        WITH RECURSIVE employee_tree AS (
          SELECT
            e."id",
            e."employeeCode",
            e."firstName",
            e."lastName",
            e."departmentId",
            e."managerId",
            0 AS depth
          FROM "Employee" e
          WHERE e."tenantId" = $1
            AND e."deletedAt" IS NULL
            AND ${anchorClause}
          UNION ALL
          SELECT
            child."id",
            child."employeeCode",
            child."firstName",
            child."lastName",
            child."departmentId",
            child."managerId",
            employee_tree.depth + 1 AS depth
          FROM "Employee" child
          INNER JOIN employee_tree ON child."managerId" = employee_tree."id"
          WHERE child."tenantId" = $1
            AND child."deletedAt" IS NULL
        )
        SELECT
          "id",
          "employeeCode",
          "firstName",
          "lastName",
          "departmentId",
          "managerId",
          depth
        FROM employee_tree
        ORDER BY depth ASC, "employeeCode" ASC
      `,
      ...params,
    );

    return serializeHrValue(rows);
  }

  async getDepartmentTree(rootDepartmentId?: string) {
    const tenantId = this.requireTenantId();
    const params = [tenantId];
    let anchorClause = `d."parentId" IS NULL`;

    if (rootDepartmentId) {
      params.push(rootDepartmentId);
      anchorClause = 'd."id" = $2';
    }

    const rows = await this.prisma.raw.$queryRawUnsafe<DepartmentTreeRow[]>(
      `
        WITH RECURSIVE department_tree AS (
          SELECT
            d."id",
            d."name",
            d."code",
            d."parentId",
            d."headId",
            0 AS depth
          FROM "Department" d
          WHERE d."tenantId" = $1
            AND d."deletedAt" IS NULL
            AND ${anchorClause}
          UNION ALL
          SELECT
            child."id",
            child."name",
            child."code",
            child."parentId",
            child."headId",
            department_tree.depth + 1 AS depth
          FROM "Department" child
          INNER JOIN department_tree ON child."parentId" = department_tree."id"
          WHERE child."tenantId" = $1
            AND child."deletedAt" IS NULL
        )
        SELECT
          "id",
          "name",
          "code",
          "parentId",
          "headId",
          depth
        FROM department_tree
        ORDER BY depth ASC, "code" ASC
      `,
      ...params,
    );

    return serializeHrValue(rows);
  }

  async createLeaveRequest(dto: CreateLeaveRequestDto) {
    const tenantId = this.requireTenantId();
    await this.ensureEmployeeExists(dto.employeeId);
    await this.ensureLeaveTypeExists(dto.leaveTypeId);

    return serializeHrValue(
      await this.prisma.tenant.leaveRequest.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          reason: dto.reason?.trim() ?? null,
          status: LeaveStatus.DRAFT,
        },
        include: {
          employee: true,
          leaveType: true,
        },
      }),
    );
  }

  async submitLeaveRequest(id: string) {
    const request = await this.getLeaveRequestRecord(id);
    if (request.status !== LeaveStatus.DRAFT) {
      throw new InvalidLeaveTransitionException(
        "Only draft leave requests can be submitted.",
      );
    }

    return serializeHrValue(
      await this.prisma.tenant.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.PENDING,
          submittedAt: new Date(),
        },
        include: {
          employee: true,
          leaveType: true,
        },
      }),
    );
  }

  async approveLeaveRequest(id: string, actor: RequestActor) {
    return serializeHrValue(
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, deletedAt: null },
          include: {
            employee: {
              include: {
                manager: true,
              },
            },
            leaveType: true,
          },
        });
        if (!request) {
          throw new NotFoundException("Leave request not found.");
        }
        if (request.status !== LeaveStatus.PENDING) {
          throw new InvalidLeaveTransitionException(
            "Only pending leave requests can be approved.",
          );
        }

        this.assertManagerOrHrActor(actor, request.employee);

        const balanceYear = new Date(request.startDate).getUTCFullYear();
        const leaveDays = this.calculateLeaveDays(
          request.startDate,
          request.endDate,
        );
        const balanceWhere: Prisma.LeaveBalanceWhereUniqueInput = {
          tenantId_employeeId_leaveTypeId_year: {
            tenantId: request.tenantId,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: balanceYear,
          },
        };
        const balance = await tx.leaveBalance.findUnique({
          where: balanceWhere,
        });
        const availableBalance = balance?.balance
          ? new Prisma.Decimal(balance.balance.toString())
          : new Prisma.Decimal("0");
        if (availableBalance.lessThan(leaveDays)) {
          throw new InsufficientLeaveBalanceException();
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            balance: availableBalance.sub(leaveDays),
          },
        });

        return tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.APPROVED,
            approvedBy: actor?.userId ?? "system",
            approvedAt: new Date(),
          },
          include: {
            employee: true,
            leaveType: true,
          },
        });
      }),
    );
  }

  async rejectLeaveRequest(
    id: string,
    dto: ReviewLeaveRequestDto,
    actor: RequestActor,
  ) {
    return serializeHrValue(
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, deletedAt: null },
          include: {
            employee: {
              include: {
                manager: true,
              },
            },
            leaveType: true,
          },
        });
        if (!request) {
          throw new NotFoundException("Leave request not found.");
        }
        if (request.status !== LeaveStatus.PENDING) {
          throw new InvalidLeaveTransitionException(
            "Only pending leave requests can be rejected.",
          );
        }

        this.assertManagerOrHrActor(actor, request.employee);

        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: dto.reason?.trim() ?? null,
          },
          include: {
            employee: true,
            leaveType: true,
          },
        });

        await tx.outboxEvent.create({
          data: {
            tenantId: request.tenantId,
            eventType: "hr.leave.rejected",
            payload: {
              leaveRequestId: request.id,
              employeeId: request.employeeId,
              reason: dto.reason?.trim() ?? null,
            },
          },
        });

        await tx.notification.create({
          data: {
            tenantId: request.tenantId,
            userId: request.employee.userId ?? actor?.userId ?? "system",
            type: "hr.leave.rejected",
            channel: NotificationChannel.IN_APP,
            title: "Leave request rejected",
            body: dto.reason?.trim() ?? "Leave request was rejected.",
            metadata: {
              leaveRequestId: request.id,
            },
          },
        });

        return updated;
      }),
    );
  }

  async cancelLeaveRequest(
    id: string,
    dto: ReviewLeaveRequestDto,
    actor: RequestActor,
  ) {
    return serializeHrValue(
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, deletedAt: null },
          include: {
            employee: {
              include: {
                manager: true,
              },
            },
            leaveType: true,
          },
        });
        if (!request) {
          throw new NotFoundException("Leave request not found.");
        }
        if (request.status !== LeaveStatus.APPROVED) {
          throw new InvalidLeaveTransitionException(
            "Only approved leave requests can be cancelled.",
          );
        }

        this.assertManagerOrHrActor(actor, request.employee);

        const startDate = new Date(request.startDate);
        if (startDate.getTime() - Date.now() < FORTY_EIGHT_HOURS_MS) {
          throw new InvalidLeaveTransitionException(
            "Approved leave can only be cancelled at least 48 hours before the start date.",
          );
        }

        const leaveDays = this.calculateLeaveDays(
          request.startDate,
          request.endDate,
        );
        const year = startDate.getUTCFullYear();
        const balanceWhere: Prisma.LeaveBalanceWhereUniqueInput = {
          tenantId_employeeId_leaveTypeId_year: {
            tenantId: request.tenantId,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        };
        const balance = await tx.leaveBalance.findUnique({
          where: balanceWhere,
        });

        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              balance: new Prisma.Decimal(balance.balance.toString()).add(
                leaveDays,
              ),
            },
          });
        }

        return tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: dto.reason?.trim() ?? null,
          },
          include: {
            employee: true,
            leaveType: true,
          },
        });
      }),
    );
  }

  async listLeaveBalances(query: HrQueryDto) {
    return serializeHrValue(
      await this.prisma.tenant.leaveBalance.findMany({
        where: {
          deletedAt: null,
          employeeId: query.employeeId,
          year: query.year,
        },
        include: {
          employee: true,
          leaveType: true,
        },
        orderBy: [{ year: "asc" }],
      }),
    );
  }

  async clockIn(dto: AttendanceActionDto) {
    const tenantId = this.requireTenantId();
    await this.ensureEmployeeExists(dto.employeeId);

    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const attendanceDate = this.toUtcStartOfDay(timestamp);
    const attendanceWhere: Prisma.AttendanceWhereUniqueInput = {
      tenantId_employeeId_date: {
        tenantId,
        employeeId: dto.employeeId,
        date: attendanceDate,
      },
    };

    return serializeHrValue(
      await this.prisma.tenant.attendance.upsert({
        where: attendanceWhere,
        create: {
          tenantId,
          employeeId: dto.employeeId,
          date: attendanceDate,
          clockIn: timestamp,
          status: dto.status ?? "PRESENT",
          overtimeHours: new Prisma.Decimal("0"),
        },
        update: {
          clockIn: timestamp,
          status: dto.status ?? "PRESENT",
        },
        include: {
          employee: true,
        },
      }),
    );
  }

  async clockOut(dto: AttendanceActionDto) {
    const tenantId = this.requireTenantId();
    const timestamp = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const attendanceDate = this.toUtcStartOfDay(timestamp);
    const attendanceWhere: Prisma.AttendanceWhereUniqueInput = {
      tenantId_employeeId_date: {
        tenantId,
        employeeId: dto.employeeId,
        date: attendanceDate,
      },
    };
    const attendance = await this.prisma.tenant.attendance.findUnique({
      where: attendanceWhere,
    });

    if (!attendance) {
      throw new NotFoundException(
        "Attendance clock-in record not found for the selected day.",
      );
    }

    const derived = this.deriveAttendanceMetrics(attendance.clockIn, timestamp);
    return serializeHrValue(
      await this.prisma.tenant.attendance.update({
        where: { id: attendance.id },
        data: {
          clockOut: timestamp,
          hoursWorked: derived.hoursWorked,
          overtimeHours: derived.overtimeHours,
          status: dto.status ?? attendance.status,
        },
        include: {
          employee: true,
        },
      }),
    );
  }

  async correctAttendance(
    id: string,
    dto: CorrectAttendanceDto,
    actor: RequestActor,
  ) {
    const attendance = await this.prisma.tenant.attendance.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        employee: {
          include: {
            manager: true,
          },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException("Attendance record not found.");
    }
    if (!dto.correctionReason?.trim()) {
      throw new AttendanceCorrectionException();
    }

    this.assertManagerOrHrActor(actor, attendance.employee);

    const clockIn =
      dto.clockIn === undefined
        ? attendance.clockIn
        : dto.clockIn
          ? new Date(dto.clockIn)
          : null;
    const clockOut =
      dto.clockOut === undefined
        ? attendance.clockOut
        : dto.clockOut
          ? new Date(dto.clockOut)
          : null;
    const derived = this.deriveAttendanceMetrics(clockIn, clockOut);

    return serializeHrValue(
      await this.prisma.tenant.attendance.update({
        where: { id },
        data: {
          clockIn,
          clockOut,
          hoursWorked: derived.hoursWorked,
          overtimeHours: derived.overtimeHours,
          status: dto.status ?? attendance.status,
          correctedBy: actor?.userId ?? "system",
          correctedAt: new Date(),
          correctionReason: dto.correctionReason.trim(),
        },
        include: {
          employee: true,
        },
      }),
    );
  }

  async listAttendance(query: HrQueryDto) {
    const rows = await this.prisma.tenant.attendance.findMany({
      where: {
        deletedAt: null,
        employeeId: query.employeeId,
      },
      include: {
        employee: true,
      },
      orderBy: [{ date: "asc" }],
    });

    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;
    const filtered = rows.filter((row) => {
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      return true;
    });

    return serializeHrValue(filtered);
  }

  private async getEmployeeRecord(
    id: string,
    additionalEmployeeInclude: Record<string, unknown> = {},
  ) {
    const employee = await this.prisma.tenant.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        department: true,
        manager: true,
        ...additionalEmployeeInclude,
      },
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }
    return employee;
  }

  private async getLeaveRequestRecord(id: string) {
    const request = await this.prisma.tenant.leaveRequest.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        employee: {
          include: {
            manager: true,
          },
        },
        leaveType: true,
      },
    });
    if (!request) {
      throw new NotFoundException("Leave request not found.");
    }
    return request;
  }

  private async ensureDepartmentExists(departmentId: string) {
    const department = await this.prisma.tenant.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
      },
    });
    if (!department) {
      throw new NotFoundException("Department not found.");
    }
    return department;
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

  private async ensureLeaveTypeExists(leaveTypeId: string) {
    const leaveType = await this.prisma.tenant.leaveType.findFirst({
      where: {
        id: leaveTypeId,
        deletedAt: null,
      },
    });
    if (!leaveType) {
      throw new NotFoundException("Leave type not found.");
    }
    return leaveType;
  }

  private async assertDepartmentHead(
    db: HrTransaction,
    headId: string,
    departmentId: string,
  ) {
    const head = await db.employee.findFirst({
      where: {
        id: headId,
        tenantId: this.requireTenantId(),
        deletedAt: null,
      },
    });
    if (!head) {
      throw new DepartmentHeadValidationException(
        "Department head must exist in the same tenant.",
      );
    }
    if (head.departmentId !== departmentId) {
      throw new DepartmentHeadValidationException();
    }
  }

  private assertManagerOrHrActor(
    actor: RequestActor,
    employee:
      | EmployeeWithManager
      | LeaveRequestWithManager["employee"]
      | AttendanceWithEmployeeManager["employee"],
  ) {
    if (!actor) {
      throw new ForbiddenException(
        "Authenticated actor required for this operation.",
      );
    }

    const roles = actor.roles ?? [];
    const isHrOverride =
      roles.includes(UserRole.HR_MANAGER) ||
      roles.includes(UserRole.TENANT_ADMIN);
    const managerUserId = employee.manager?.userId;
    const managerEmployeeId = employee.manager?.id;
    const isDirectManager =
      actor.userId === managerUserId || actor.userId === managerEmployeeId;

    if (isDirectManager || isHrOverride) {
      return;
    }

    throw new ForbiddenException(
      "Only the direct manager or HR manager can perform this action.",
    );
  }

  private deriveAttendanceMetrics(clockIn: Date | null, clockOut: Date | null) {
    if (!clockIn || !clockOut) {
      return {
        hoursWorked: null,
        overtimeHours: new Prisma.Decimal("0"),
      };
    }

    if (clockOut < clockIn) {
      throw new AttendanceCorrectionException(
        "Attendance clock-out time must be after clock-in time.",
      );
    }

    const durationMs = new Prisma.Decimal(
      String(clockOut.getTime() - clockIn.getTime()),
    );
    const hoursWorked = durationMs
      .div(MILLIS_PER_HOUR)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const overtimeHours = Prisma.Decimal.max(
      hoursWorked.sub(HOURS_PER_DAY),
      new Prisma.Decimal("0"),
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return {
      hoursWorked,
      overtimeHours,
    };
  }

  private calculateLeaveDays(startDate: Date, endDate: Date) {
    const start = this.toUtcStartOfDay(startDate);
    const end = this.toUtcStartOfDay(endDate);
    const days =
      Math.floor((end.getTime() - start.getTime()) / MILLIS_PER_DAY) + 1;
    return new Prisma.Decimal(String(days));
  }

  private toUtcStartOfDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private resolveLifecycleStatus(hireDate: Date, terminationDate: Date | null) {
    const now = new Date();
    if (terminationDate && terminationDate <= now) {
      return EmployeeStatus.TERMINATED;
    }
    if (hireDate > now) {
      return EmployeeStatus.PRE_START;
    }
    return EmployeeStatus.ACTIVE;
  }

  private requireTenantId() {
    const tenantId = this.cls.get("tenantId");
    if (!tenantId || tenantId === "*") {
      throw new ForbiddenException(
        "HR endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }
}
