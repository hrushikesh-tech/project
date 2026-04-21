import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsExceptionFilter } from "./notifications-exception.filter";
import { TemplateRendererService } from "./template-renderer.service";
import { NotificationDeliveryService } from "./notification-delivery.service";
import {
  NotificationsQueue,
  NOTIFICATIONS_QUEUE,
} from "./queue/notifications.queue";
import { NotificationsProcessor } from "./queue/notifications.processor";
import { OutboxPollerService } from "./outbox-poller.service";
import { InAppChannelService } from "./channels/in-app-channel.service";
import { EmailChannelService } from "./channels/email-channel.service";
import { SmsChannelService } from "./channels/sms-channel.service";
import { WebhookChannelService } from "./channels/webhook-channel.service";

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TemplateRendererService,
    NotificationDeliveryService,
    NotificationsQueue,
    NotificationsProcessor,
    OutboxPollerService,
    InAppChannelService,
    EmailChannelService,
    SmsChannelService,
    WebhookChannelService,
    {
      provide: APP_FILTER,
      useClass: NotificationsExceptionFilter,
    },
  ],
  exports: [
    NotificationsService,
    NotificationDeliveryService,
    OutboxPollerService,
  ],
})
export class NotificationsModule {}
