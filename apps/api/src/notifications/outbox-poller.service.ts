import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "../common/schedule/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsQueue } from "./queue/notifications.queue";

const CLAIM_BATCH_SIZE = 25;
type OutboxEventDelegate = {
  findMany(
    args: Record<string, unknown>,
  ): Promise<Array<{ id: string; tenantId: string }>>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
};

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationsQueue,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async poll() {
    await this.pollOnce();
  }

  async pollOnce() {
    const currentTime = new Date();
    const prismaLike = this.prisma as unknown as {
      raw?: { outboxEvent?: OutboxEventDelegate };
      tenant?: { outboxEvent?: OutboxEventDelegate };
      outboxEvent?: OutboxEventDelegate;
    };
    const outboxEventDelegate =
      prismaLike.raw?.outboxEvent ??
      prismaLike.tenant?.outboxEvent ??
      prismaLike.outboxEvent;
    const events = await outboxEventDelegate.findMany({
      where: {
        deletedAt: null,
        status: "PENDING",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: currentTime } }],
      },
      orderBy: [{ createdAt: "asc" }],
      take: CLAIM_BATCH_SIZE,
    });

    for (const event of events) {
      const claim = await outboxEventDelegate.updateMany({
        where: {
          id: event.id,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
          processingStartedAt: currentTime,
          lastError: null,
        },
      });

      if (claim.count === 1) {
        await this.queue.enqueueDelivery({
          tenantId: event.tenantId,
          eventId: event.id,
        });
      }
    }

    if (events.length > 0) {
      this.logger.debug(
        `Queued ${events.length} notification event(s) for delivery.`,
      );
    }
  }
}
