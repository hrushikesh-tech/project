import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { Queue } from "bullmq";
import { areBackgroundQueuesEnabled } from "../../common/queue/queue-runtime";

export const NOTIFICATIONS_QUEUE = "notifications";
export const PROCESS_OUTBOX_EVENT_JOB = "process-outbox-event";

export interface NotificationDeliveryJobPayload {
  tenantId: string;
  eventId: string;
}

@Injectable()
export class NotificationsQueue {
  private readonly logger = new Logger(NotificationsQueue.name);

  constructor(
    @Optional()
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue?: Queue<NotificationDeliveryJobPayload>,
  ) {}

  async enqueueDelivery(payload: NotificationDeliveryJobPayload) {
    if (!areBackgroundQueuesEnabled() || !this.queue) {
      this.logger.warn(
        `Skipping notification delivery enqueue for outbox event ${payload.eventId} because background queues are disabled.`,
      );
      return { skipped: true, eventId: payload.eventId };
    }

    return this.queue.add(PROCESS_OUTBOX_EVENT_JOB, payload, {
      jobId: `${PROCESS_OUTBOX_EVENT_JOB}:${payload.eventId}`,
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }
}
