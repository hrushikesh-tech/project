import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Prisma } from "@amdox/db";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EMPLOYEE_EFFECTIVE_STATUS_JOB,
  HR_OPERATIONS_QUEUE,
  HrOperationJobPayload,
  LEAVE_ACCRUAL_NIGHTLY_JOB,
  LEAVE_AUTO_CANCEL_JOB,
} from "./hr-operations.queue";

@Injectable()
@Processor(HR_OPERATIONS_QUEUE)
export class HrOperationsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<HrOperationJobPayload>) {
    if (job.name === LEAVE_ACCRUAL_NIGHTLY_JOB) {
      return this.runLeaveAccrual(job.data.tenantId);
    }
    if (job.name === LEAVE_AUTO_CANCEL_JOB) {
      return this.runLeaveAutoCancel(job.data.tenantId);
    }
    if (job.name === EMPLOYEE_EFFECTIVE_STATUS_JOB) {
      return this.runEmployeeEffectiveStatus(job.data.tenantId);
    }

    return { skipped: true, jobName: job.name };
  }

  async runLeaveAccrual(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    const accrualDate = new Date();
    const currentYear = accrualDate.getUTCFullYear();

    const [leaveTypes, employees, balances] = await Promise.all([
      db.leaveType.findMany({
        where: { deletedAt: null },
        orderBy: [{ code: "asc" }],
      }),
      db.employee.findMany({
        where: {
          deletedAt: null,
          status: { not: "TERMINATED" },
        },
      }),
      db.leaveBalance.findMany({
        where: {
          deletedAt: null,
          year: currentYear,
        },
      }),
    ]);

    const existingByKey = new Map(
      balances.map((balance) => [
        `${balance.employeeId}:${balance.leaveTypeId}:${balance.year}`,
        balance,
      ]),
    );

    let processed = 0;
    for (const employee of employees) {
      for (const leaveType of leaveTypes) {
        const key = `${employee.id}:${leaveType.id}:${currentYear}`;
        const currentBalance = existingByKey.get(key);
        const balanceWhere: Prisma.LeaveBalanceWhereUniqueInput = {
          tenantId_employeeId_leaveTypeId_year: {
            tenantId,
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
          },
        };

        const nextBalance = currentBalance
          ? Prisma.Decimal.min(
              new Prisma.Decimal(currentBalance.balance.toString()).add(
                leaveType.accrualRate,
              ),
              leaveType.maxBalance,
            )
          : Prisma.Decimal.min(
              new Prisma.Decimal(leaveType.accrualRate.toString()),
              leaveType.maxBalance,
            );

        await db.leaveBalance.upsert({
          where: balanceWhere,
          create: {
            tenantId,
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
            balance: nextBalance,
          },
          update: {
            balance: nextBalance,
          },
        });
        processed += 1;
      }
    }

    return { processed, tenantId };
  }

  async runLeaveAutoCancel(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    const now = new Date();
    const requests = await db.leaveRequest.findMany({
      where: {
        deletedAt: null,
        status: "PENDING",
        startDate: {
          lt: now,
        },
      },
    });

    let processed = 0;
    for (const request of requests) {
      if (
        request.status === "CANCELLED" &&
        request.systemReason === "AUTO_CANCELLED_AFTER_START_DATE"
      ) {
        continue;
      }

      await db.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          systemReason: "AUTO_CANCELLED_AFTER_START_DATE",
        },
      });
      processed += 1;
    }

    return { processed, tenantId };
  }

  async runEmployeeEffectiveStatus(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    const now = new Date();
    const employees = await db.employee.findMany({
      where: {
        deletedAt: null,
        terminationDate: {
          lte: now,
        },
      },
    });

    let processed = 0;
    for (const employee of employees) {
      if (employee.status === "TERMINATED") {
        continue;
      }

      await db.employee.update({
        where: { id: employee.id },
        data: { status: "TERMINATED" },
      });
      processed += 1;
    }

    return { processed, tenantId };
  }
}
