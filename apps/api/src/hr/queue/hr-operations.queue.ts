import { Logger, OnModuleInit, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { CronExpression } from "../../common/schedule/schedule";
import { isWorkerRuntime } from "../../runtime/runtime-mode";
import { areBackgroundQueuesEnabled } from "../../common/queue/queue-runtime";

export const HR_OPERATIONS_QUEUE = "hr-operations";
export const LEAVE_ACCRUAL_NIGHTLY_JOB = "leave-accrual-nightly";
export const LEAVE_AUTO_CANCEL_JOB = "leave-auto-cancel";
export const EMPLOYEE_EFFECTIVE_STATUS_JOB = "employee-effective-status";

export interface HrOperationJobPayload {
  tenantId: string;
}

export class HrOperationsQueue implements OnModuleInit {
  private readonly logger = new Logger(HrOperationsQueue.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(HR_OPERATIONS_QUEUE)
    private readonly queue?: Queue<HrOperationJobPayload>,
  ) {}

  async onModuleInit() {
    if (!areBackgroundQueuesEnabled() || !this.queue) {
      this.logger.warn(
        "HR operations queue is disabled because Redis-backed background queues are unavailable.",
      );
      return;
    }

    if (!isWorkerRuntime()) {
      return;
    }

    try {
      const tenants = await this.prisma.raw.tenant.findMany({
        where: { deletedAt: null },
      });

      for (const tenant of tenants) {
        await this.registerNightlyJob(LEAVE_ACCRUAL_NIGHTLY_JOB, tenant.id);
        await this.registerNightlyJob(LEAVE_AUTO_CANCEL_JOB, tenant.id);
        await this.registerNightlyJob(EMPLOYEE_EFFECTIVE_STATUS_JOB, tenant.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`HR repeatable jobs were not registered: ${message}`);
    }
  }

  private async registerNightlyJob(jobName: string, tenantId: string) {
    await this.queue.add(
      jobName,
      { tenantId },
      {
        jobId: `${jobName}:${tenantId}`,
        repeat: {
          pattern: CronExpression.EVERY_DAY_AT_1AM,
        },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );
  }
}
