import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

export const NOTIFICATIONS_QUEUE = "notifications";
export const PROCESS_OUTBOX_EVENT_JOB = "process-outbox-event";

export interface NotificationDeliveryJobPayload {
  tenantId: string;
  eventId: string;
}

@Injectable()
export class NotificationsQueue {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationDeliveryJobPayload>,
  ) {}

  async enqueueDelivery(payload: NotificationDeliveryJobPayload) {
    return this.queue.add(PROCESS_OUTBOX_EVENT_JOB, payload, {
      jobId: `${PROCESS_OUTBOX_EVENT_JOB}:${payload.eventId}`,
      removeOnComplete: 50,
      removeOnFail: 50,
    });
  }
}
