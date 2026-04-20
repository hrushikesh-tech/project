import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { CronExpression } from "../../common/schedule/schedule";

export const FORECASTING_QUEUE = "forecasting-operations";
export const WEEKLY_RETRAIN_JOB = "weekly-retrain";

export interface ForecastingJobPayload {
  tenantId: string;
}

@Injectable()
export class ForecastingQueue implements OnModuleInit {
  private readonly logger = new Logger(ForecastingQueue.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FORECASTING_QUEUE)
    private readonly queue: Queue<ForecastingJobPayload>,
  ) {}

  async onModuleInit() {
    try {
      const tenants = await this.prisma.raw.tenant.findMany({
        where: { deletedAt: null },
      });

      for (const tenant of tenants) {
        await this.queue.add(
          WEEKLY_RETRAIN_JOB,
          { tenantId: tenant.id },
          {
            jobId: `${WEEKLY_RETRAIN_JOB}:${tenant.id}`,
            repeat: {
              pattern: CronExpression.EVERY_WEEK,
            },
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Forecasting repeatable jobs were not registered: ${message}`,
      );
    }
  }
}
