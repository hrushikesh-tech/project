import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@amdox/db";
import {
  PayrollCalculationInput,
  PayrollRunStatus,
  SalaryComponentType,
  TaxRegime,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { PayrollQueryDto } from "./dto/payroll-query.dto";
import { UpsertSalaryStructureDto } from "./dto/upsert-salary-structure.dto";
import { serializePayrollValue } from "./payroll.serialization";
import { PayrollQueue } from "./queue/payroll.queue";

type PayrollTx = Prisma.TransactionClient;

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly payrollQueue: PayrollQueue,
  ) {}

  async upsertSalaryStructure(
    employeeId: string,
    dto: UpsertSalaryStructureDto,
  ) {
    const tenantId = this.requireTenantId();
    await this.ensureEmployeeExists(employeeId);
    await this.ensureLegalEntityExists(dto.legalEntityId);

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        "Salary structure effectiveTo must be after effectiveFrom.",
      );
    }

    const structure = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.salaryStructure.findFirst({
        where: {
          tenantId,
          employeeId,
          legalEntityId: dto.legalEntityId,
          effectiveFrom,
          deletedAt: null,
        },
        include: {
          components: true,
          employee: true,
          legalEntity: true,
        },
      });

      if (!existing) {
        await this.closeOverlappingStructures(tx, {
          tenantId,
          employeeId,
          legalEntityId: dto.legalEntityId,
          effectiveFrom,
        });
      }

      const structure = existing
        ? await tx.salaryStructure.update({
            where: { id: existing.id },
            data: {
              name: dto.name?.trim() ?? existing.name,
              currency: dto.currency?.trim().toUpperCase() ?? existing.currency,
              taxRegime: dto.taxRegime,
              effectiveTo,
              pfApplicable: dto.pfApplicable ?? existing.pfApplicable,
              professionalTaxApplicable:
                dto.professionalTaxApplicable ??
                existing.professionalTaxApplicable,
              overtimeEligible:
                dto.overtimeEligible ?? existing.overtimeEligible,
            },
          })
        : await tx.salaryStructure.create({
            data: {
              tenantId,
              employeeId,
              legalEntityId: dto.legalEntityId,
              name: dto.name?.trim() ?? "Payroll Structure",
              currency: dto.currency?.trim().toUpperCase() ?? "INR",
              taxRegime: dto.taxRegime,
              effectiveFrom,
              effectiveTo,
              pfApplicable: dto.pfApplicable ?? true,
              professionalTaxApplicable: dto.professionalTaxApplicable ?? true,
              overtimeEligible: dto.overtimeEligible ?? true,
            },
          });

      await tx.salaryComponent.deleteMany({
        where: {
          salaryStructureId: structure.id,
        },
      });

      await tx.salaryComponent.createMany({
        data: dto.components.map((component) => ({
          tenantId,
          salaryStructureId: structure.id,
          code: component.code.trim().toUpperCase(),
          name: component.name.trim(),
          componentType: component.componentType,
          amountMinor: BigInt(component.amountMinor),
          calculationType:
            component.calculationType?.trim().toUpperCase() ?? "FIXED",
          isRecurring: component.isRecurring ?? true,
          isTaxable: component.isTaxable ?? true,
          pfApplicable: component.pfApplicable ?? false,
          professionalTaxApplicable:
            component.professionalTaxApplicable ?? false,
          overtimeApplicable: component.overtimeApplicable ?? false,
          sortOrder: component.sortOrder ?? 0,
        })),
      });

      return tx.salaryStructure.findFirst({
        where: { id: structure.id },
        include: {
          components: true,
          employee: true,
          legalEntity: true,
        },
      });
    });

    return serializePayrollValue(structure);
  }

  async getSalaryStructure(employeeId: string) {
    await this.ensureEmployeeExists(employeeId);
    const structure = await this.prisma.tenant.salaryStructure.findFirst({
      where: {
        employeeId,
        deletedAt: null,
      },
      include: {
        components: true,
        employee: true,
        legalEntity: true,
      },
      orderBy: [{ effectiveFrom: "desc" }],
    });

    if (!structure) {
      throw new NotFoundException("Salary structure not found.");
    }

    return serializePayrollValue(structure);
  }

  async createPayrollRun(dto: CreatePayrollRunDto) {
    const tenantId = this.requireTenantId();
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException(
        "Payroll periodEnd must be after or equal to periodStart.",
      );
    }

    await this.ensureLegalEntityExists(dto.legalEntityId);
    const fiscalPeriodId =
      dto.fiscalPeriodId ??
      (await this.findOpenFiscalPeriodId(
        dto.legalEntityId,
        periodStart,
        periodEnd,
      ));

    const run = await this.prisma.$transaction(async (tx) => {
      const matchingRuns = await tx.payrollRun.findMany({
        where: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          periodStart,
          periodEnd,
          deletedAt: null,
        },
        orderBy: [{ attemptNumber: "desc" }],
      });

      const blockingRun = matchingRuns.find(
        (run) =>
          run.status !== PayrollRunStatus.FAILED &&
          run.status !== PayrollRunStatus.REVERSED,
      );
      if (blockingRun) {
        throw new BadRequestException(
          "A payroll run already exists for this legal entity and pay period.",
        );
      }

      const salaryStructures = await tx.salaryStructure.findMany({
        where: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          deletedAt: null,
          effectiveFrom: { lte: periodEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
        },
        include: {
          components: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          },
          employee: true,
        },
        orderBy: [{ effectiveFrom: "desc" }],
      });

      const latestStructureByEmployee = new Map<
        string,
        (typeof salaryStructures)[number]
      >();
      for (const structure of salaryStructures) {
        if (!latestStructureByEmployee.has(structure.employeeId)) {
          latestStructureByEmployee.set(structure.employeeId, structure);
        }
      }

      const activeStructures = [...latestStructureByEmployee.values()];
      if (activeStructures.length === 0) {
        throw new BadRequestException(
          "No active salary structures found for the selected payroll scope.",
        );
      }

      const run = await tx.payrollRun.create({
        data: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          period: dto.period?.trim() ?? this.makePeriodLabel(periodStart),
          periodStart,
          periodEnd,
          status: dto.enqueueImmediately
            ? PayrollRunStatus.PROCESSING
            : PayrollRunStatus.DRAFT,
          processingStage: "SNAPSHOT_CREATED",
          attemptNumber: (matchingRuns[0]?.attemptNumber ?? 0) + 1,
          queuedAt: dto.enqueueImmediately ? new Date() : null,
          totalCount: activeStructures.length,
          processedCount: 0,
        },
      });

      const inputSnapshots: Prisma.PayrollResultCreateManyInput[] = [];
      for (const structure of activeStructures) {
        const snapshot = await this.buildPayrollInputSnapshot(tx, {
          tenantId,
          structure,
          periodStart,
          periodEnd,
          fiscalPeriodId,
        });
        inputSnapshots.push({
          tenantId,
          payrollRunId: run.id,
          employeeId: structure.employeeId,
          salaryStructureId: structure.id,
          status: "PENDING",
          processingStage: "SNAPSHOT_CREATED",
          grossPay: 0n,
          totalDeductions: 0n,
          netPay: 0n,
          earnings: [],
          deductions: [],
          taxBreakdown: {},
          payableDays: new Prisma.Decimal(String(snapshot.payableDays)),
          lossOfPay: 0n,
          overtime: 0n,
          overtimeHours: new Prisma.Decimal(String(snapshot.overtimeHours)),
          workingDays: snapshot.workingDays,
          presentDays: new Prisma.Decimal(String(snapshot.presentDays)),
          leaveDays: new Prisma.Decimal(String(snapshot.leaveDays)),
          inputSnapshot: snapshot,
        });
      }

      await tx.payrollResult.createMany({ data: inputSnapshots });

      return tx.payrollRun.findFirst({
        where: { id: run.id },
        include: {
          legalEntity: true,
          payrollResults: true,
        },
      });
    });

    if (dto.enqueueImmediately) {
      await this.payrollQueue.enqueueRun({
        tenantId,
        payrollRunId: run.id,
      });
    }

    return serializePayrollValue(run);
  }

  async listPayrollRuns(query: PayrollQueryDto) {
    return serializePayrollValue(
      await this.prisma.tenant.payrollRun.findMany({
        where: {
          deletedAt: null,
          legalEntityId: query.legalEntityId,
          status: query.status,
          period: query.period,
        },
        include: {
          legalEntity: true,
        },
        orderBy: [{ createdAt: "desc" }],
      }),
    );
  }

  async getPayrollRun(id: string) {
    const run = await this.prisma.tenant.payrollRun.findFirst({
      where: { id, deletedAt: null },
      include: {
        legalEntity: true,
        payrollResults: true,
      },
    });
    if (!run) {
      throw new NotFoundException("Payroll run not found.");
    }
    return serializePayrollValue(run);
  }

  async listPayrollResults(id: string) {
    await this.getPayrollRun(id);
    return serializePayrollValue(
      await this.prisma.tenant.payrollResult.findMany({
        where: {
          payrollRunId: id,
          deletedAt: null,
        },
        include: {
          employee: true,
          salaryStructure: {
            include: {
              components: true,
            },
          },
          payslip: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
    );
  }

  private async buildPayrollInputSnapshot(
    tx: PayrollTx,
    params: {
      tenantId: string;
      structure: Prisma.SalaryStructureGetPayload<{
        include: { components: true; employee: true };
      }>;
      periodStart: Date;
      periodEnd: Date;
      fiscalPeriodId: string;
    },
  ): Promise<PayrollCalculationInput & { fiscalPeriodId: string }> {
    const attendances = await tx.attendance.findMany({
      where: {
        tenantId: params.tenantId,
        employeeId: params.structure.employeeId,
        deletedAt: null,
        date: {
          gte: params.periodStart,
          lte: params.periodEnd,
        },
      },
    });

    const approvedLeaves = await tx.leaveRequest.findMany({
      where: {
        tenantId: params.tenantId,
        employeeId: params.structure.employeeId,
        deletedAt: null,
        status: "APPROVED",
        startDate: { lte: params.periodEnd },
        endDate: { gte: params.periodStart },
      },
    });

    const workingDays = this.countInclusiveDays(
      params.periodStart,
      params.periodEnd,
    );
    const presentDays = attendances.reduce((sum, attendance) => {
      if (attendance.status === "HALF_DAY") {
        return sum + 0.5;
      }
      if (
        attendance.status === "PRESENT" ||
        attendance.status === "WORK_FROM_HOME"
      ) {
        return sum + 1;
      }
      return sum;
    }, 0);
    const leaveDays = approvedLeaves.reduce(
      (sum, request) =>
        sum +
        this.countOverlappingDays(
          request.startDate,
          request.endDate,
          params.periodStart,
          params.periodEnd,
        ),
      0,
    );
    const payableDays = Math.min(workingDays, presentDays + leaveDays);
    const overtimeHours = attendances.reduce(
      (sum, attendance) =>
        sum + Number(attendance.overtimeHours?.toString() ?? "0"),
      0,
    );

    return {
      tenantId: params.tenantId,
      employeeId: params.structure.employeeId,
      salaryStructureId: params.structure.id,
      legalEntityId: params.structure.legalEntityId,
      fiscalPeriodId: params.fiscalPeriodId,
      periodStart: params.periodStart.toISOString(),
      periodEnd: params.periodEnd.toISOString(),
      currency: params.structure.currency,
      taxRegime: params.structure.taxRegime as TaxRegime,
      workingDays,
      payableDays,
      presentDays,
      leaveDays,
      overtimeHours,
      overtimeEligible: params.structure.overtimeEligible,
      earningsComponents: params.structure.components
        .filter(
          (component) =>
            component.componentType === SalaryComponentType.EARNING,
        )
        .map((component) => ({
          code: component.code,
          name: component.name,
          amountMinor: BigInt(component.amountMinor.toString()),
          componentType: SalaryComponentType.EARNING,
          isTaxable: component.isTaxable,
          pfApplicable: params.structure.pfApplicable && component.pfApplicable,
          professionalTaxApplicable:
            params.structure.professionalTaxApplicable &&
            component.professionalTaxApplicable,
          overtimeApplicable:
            params.structure.overtimeEligible && component.overtimeApplicable,
        })),
      deductionComponents: params.structure.components
        .filter(
          (component) =>
            component.componentType === SalaryComponentType.DEDUCTION,
        )
        .map((component) => ({
          code: component.code,
          name: component.name,
          amountMinor: BigInt(component.amountMinor.toString()),
          componentType: SalaryComponentType.DEDUCTION,
          isTaxable: component.isTaxable,
          pfApplicable: component.pfApplicable,
          professionalTaxApplicable: component.professionalTaxApplicable,
          overtimeApplicable: component.overtimeApplicable,
        })),
    };
  }

  private async closeOverlappingStructures(
    tx: PayrollTx,
    params: {
      tenantId: string;
      employeeId: string;
      legalEntityId: string;
      effectiveFrom: Date;
    },
  ) {
    const overlapping = await tx.salaryStructure.findMany({
      where: {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        legalEntityId: params.legalEntityId,
        deletedAt: null,
        effectiveFrom: { lt: params.effectiveFrom },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: params.effectiveFrom } },
        ],
      },
    });

    const closingDate = new Date(params.effectiveFrom);
    closingDate.setUTCDate(closingDate.getUTCDate() - 1);

    for (const structure of overlapping) {
      await tx.salaryStructure.update({
        where: { id: structure.id },
        data: { effectiveTo: closingDate },
      });
    }
  }

  private async ensureEmployeeExists(employeeId: string) {
    const employee = await this.prisma.tenant.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }
    return employee;
  }

  private async ensureLegalEntityExists(legalEntityId: string) {
    const entity = await this.prisma.tenant.legalEntity.findFirst({
      where: { id: legalEntityId, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException("Legal entity not found.");
    }
    return entity;
  }

  private async findOpenFiscalPeriodId(
    legalEntityId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const period = await this.prisma.tenant.fiscalPeriod.findFirst({
      where: {
        legalEntityId,
        deletedAt: null,
        isClosed: false,
        startDate: { lte: periodStart },
        endDate: { gte: periodEnd },
      },
      orderBy: [{ startDate: "asc" }],
    });
    if (!period) {
      throw new BadRequestException(
        "No open fiscal period covers the selected payroll period.",
      );
    }
    return period.id;
  }

  private countInclusiveDays(start: Date, end: Date) {
    return (
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
  }

  private countOverlappingDays(
    rangeStart: Date,
    rangeEnd: Date,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const start = rangeStart > periodStart ? rangeStart : periodStart;
    const end = rangeEnd < periodEnd ? rangeEnd : periodEnd;
    if (end < start) {
      return 0;
    }
    return this.countInclusiveDays(start, end);
  }

  private makePeriodLabel(periodStart: Date) {
    return periodStart.toISOString().slice(0, 7);
  }

  private requireTenantId() {
    const tenantId = this.cls.get("tenantId");
    if (!tenantId || tenantId === "*") {
      throw new ForbiddenException(
        "Payroll endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }
}
