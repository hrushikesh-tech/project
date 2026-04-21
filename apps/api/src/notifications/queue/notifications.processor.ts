import { Injectable } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { NotificationDeliveryService } from "../notification-delivery.service";
import {
  NOTIFICATIONS_QUEUE,
  NotificationDeliveryJobPayload,
  PROCESS_OUTBOX_EVENT_JOB,
} from "./notifications.queue";

@Injectable()
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {
    super();
  }

  async process(job: Job<NotificationDeliveryJobPayload>) {
    if (job.name !== PROCESS_OUTBOX_EVENT_JOB) {
      return { skipped: true, jobName: job.name };
    }

    return this.notificationDeliveryService.processEvent(job.data);
  }
}
