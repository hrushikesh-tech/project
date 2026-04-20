import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { CronExpression } from "../../common/schedule/schedule";

export const SUPPLY_CHAIN_QUEUE = "supply-chain-operations";
export const AUTO_REORDER_JOB = "auto-reorder";

export interface SupplyChainJobPayload {
  tenantId: string;
}

@Injectable()
export class SupplyChainQueue implements OnModuleInit {
  private readonly logger = new Logger(SupplyChainQueue.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SUPPLY_CHAIN_QUEUE)
    private readonly queue: Queue<SupplyChainJobPayload>,
  ) {}

  async onModuleInit() {
    try {
      const tenants = await this.prisma.raw.tenant.findMany({
        where: { deletedAt: null },
      });

      for (const tenant of tenants) {
        await this.queue.add(
          AUTO_REORDER_JOB,
          { tenantId: tenant.id },
          {
            jobId: `${AUTO_REORDER_JOB}:${tenant.id}`,
            repeat: {
              pattern: CronExpression.EVERY_6_HOURS,
            },
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Supply-chain repeatable jobs were not registered: ${message}`,
      );
    }
  }
}
