import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { Queue } from "bullmq";
import { areBackgroundQueuesEnabled } from "../../common/queue/queue-runtime";
import { PrismaService } from "../../prisma/prisma.service";

export const BI_REPORT_QUEUE = "bi-reporting";
export const BI_REPORT_JOB = "schedule-report";

export interface BiReportJobPayload {
  tenantId: string;
  scheduleId: string;
}

@Injectable()
export class BiReportQueue implements OnModuleInit {
  private readonly logger = new Logger(BiReportQueue.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(BI_REPORT_QUEUE)
    private readonly queue?: Queue<BiReportJobPayload>,
  ) {}

  async onModuleInit() {
    if (!areBackgroundQueuesEnabled() || !this.queue) {
      this.logger.warn(
        "BI report queue is disabled because Redis-backed background queues are unavailable.",
      );
      return;
    }

    try {
      const schedules = await this.prisma.raw.reportSchedule.findMany({
        where: {
          deletedAt: null,
          isEnabled: true,
        },
      });
      for (const schedule of schedules) {
        await this.registerSchedule(schedule);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`BI repeatable jobs were not registered: ${message}`);
    }
  }

  async registerSchedule(schedule: {
    id: string;
    tenantId: string;
    cronExpression: string;
    isEnabled: boolean;
  }) {
    if (!this.queue) {
      this.logger.warn(
        `Skipping BI report schedule registration for ${schedule.id} because the queue is unavailable.`,
      );
      return;
    }

    if (!schedule.isEnabled) {
      return this.removeSchedule(schedule.id);
    }

    await this.queue.add(
      BI_REPORT_JOB,
      { tenantId: schedule.tenantId, scheduleId: schedule.id },
      {
        jobId: `${BI_REPORT_JOB}:${schedule.id}`,
        repeat: {
          pattern: schedule.cronExpression,
        },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );
  }

  async syncSchedule(schedule: {
    id: string;
    tenantId: string;
    cronExpression: string;
    isEnabled: boolean;
  }) {
    await this.removeSchedule(schedule.id);
    await this.registerSchedule(schedule);
  }

  async removeSchedule(scheduleId: string) {
    if (!this.queue) {
      return;
    }

    const repeatables = await this.queue.getRepeatableJobs();
    for (const job of repeatables) {
      if (
        job.id === `${BI_REPORT_JOB}:${scheduleId}` ||
        job.key.includes(scheduleId)
      ) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
  }
}
