import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import {
  NotificationActorRequiredException,
  NotificationAdminAccessException,
  NotificationPreferenceRow,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../common/interfaces/request-user.interface";
import {
  getNotificationCatalogEntry,
  isNotificationEventType,
  listNotificationCatalogEntries,
} from "./event-catalog";
import { TemplateRendererService } from "./template-renderer.service";
import { serializeNotificationValue } from "./notifications.serialization";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { UpsertNotificationTemplateDto } from "./dto/upsert-notification-template.dto";
import { UpsertWebhookConfigDto } from "./dto/upsert-webhook-config.dto";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    private readonly templateRenderer: TemplateRendererService,
  ) {}

  async listNotifications(
    actor: RequestUser,
    query: ListNotificationsQueryDto,
  ) {
    this.requireTenantId();
    const currentActor = this.requireActor(actor);
    return serializeNotificationValue(
      await this.prisma.tenant.notification.findMany({
        where: {
          deletedAt: null,
          userId: currentActor.userId,
          type: query.eventType,
          channel: query.channel as NotificationChannel | undefined,
          isRead: query.unreadOnly ? false : undefined,
        },
        orderBy: [{ createdAt: "desc" }],
        take: query.limit ?? 50,
      }),
    );
  }

  async markRead(id: string, actor: RequestUser) {
    this.requireTenantId();
    const currentActor = this.requireActor(actor);
    const notification = await this.prisma.tenant.notification.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    if (!notification || notification.userId !== currentActor.userId) {
      throw new NotFoundException("Notification not found.");
    }

    return serializeNotificationValue(
      await this.prisma.tenant.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: notification.readAt ?? new Date(),
        },
      }),
    );
  }

  async listPreferences(actor: RequestUser, eventType?: string) {
    const currentActor = this.requireActor(actor);
    const entries = eventType
      ? listNotificationCatalogEntries().filter(
          (entry) => entry.eventType === eventType,
        )
      : listNotificationCatalogEntries().filter((entry) => !entry.futureFacing);

    const explicitPreferences =
      await this.prisma.tenant.notificationPreference.findMany({
        where: {
          deletedAt: null,
          userId: currentActor.userId,
          eventType,
        },
        orderBy: [{ eventType: "asc" }],
      });

    const rows: NotificationPreferenceRow[] = [];
    for (const entry of entries) {
      for (const channel of entry.channels) {
        const explicit = explicitPreferences.find(
          (item) =>
            item.eventType === entry.eventType && item.channel === channel,
        );
        rows.push({
          eventType: entry.eventType,
          channel,
          enabled: explicit ? explicit.enabled : true,
          explicit: Boolean(explicit),
        });
      }
    }

    return serializeNotificationValue(rows);
  }

  async upsertPreference(
    actor: RequestUser,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const currentActor = this.requireActor(actor);
    if (!isNotificationEventType(dto.eventType)) {
      throw new BadRequestException("Unsupported notification event type.");
    }

    const entry = getNotificationCatalogEntry(dto.eventType);
    if (!entry?.channels.includes(dto.channel as NotificationChannel)) {
      throw new BadRequestException("Unsupported channel for the event type.");
    }

    return serializeNotificationValue(
      await this.prisma.tenant.notificationPreference.upsert({
        where: {
          tenantId_userId_eventType_channel: {
            tenantId: this.requireTenantId(),
            userId: currentActor.userId,
            eventType: dto.eventType,
            channel: dto.channel as NotificationChannel,
          },
        },
        create: {
          tenantId: this.requireTenantId(),
          userId: currentActor.userId,
          eventType: dto.eventType,
          channel: dto.channel as NotificationChannel,
          enabled: dto.enabled,
        },
        update: {
          enabled: dto.enabled,
        },
      }),
    );
  }

  async listTemplates(
    actor: RequestUser,
    eventType?: string,
    channel?: string,
  ) {
    this.assertAdmin(actor);
    const entries = eventType
      ? listNotificationCatalogEntries().filter(
          (entry) => entry.eventType === eventType,
        )
      : listNotificationCatalogEntries().filter((entry) => !entry.futureFacing);

    const rows = [];
    for (const entry of entries) {
      const channels = channel
        ? entry.channels.filter((value) => value === channel)
        : entry.channels.filter(
            (value) => value !== NotificationChannel.WEBHOOK,
          );
      for (const supportedChannel of channels) {
        const override =
          await this.prisma.tenant.notificationTemplate.findFirst({
            where: {
              tenantId: this.requireTenantId(),
              eventType: entry.eventType,
              channel: supportedChannel,
              deletedAt: null,
            },
          });
        const fallback = this.templateRenderer.getDefaultTemplate(
          entry.eventType,
          supportedChannel,
        );
        const template = override ?? fallback;
        if (template) {
          rows.push({
            eventType: entry.eventType,
            channel: supportedChannel,
            source: override ? "TENANT_OVERRIDE" : "PLATFORM_DEFAULT",
            subject: template.subject ?? null,
            body: template.body,
          });
        }
      }
    }

    return serializeNotificationValue(rows);
  }

  async upsertTemplate(actor: RequestUser, dto: UpsertNotificationTemplateDto) {
    this.assertAdmin(actor);
    if (!isNotificationEventType(dto.eventType)) {
      throw new BadRequestException("Unsupported notification event type.");
    }

    return serializeNotificationValue(
      await this.prisma.tenant.notificationTemplate.upsert({
        where: {
          tenantId_eventType_channel: {
            tenantId: this.requireTenantId(),
            eventType: dto.eventType,
            channel: dto.channel as NotificationChannel,
          },
        },
        create: {
          tenantId: this.requireTenantId(),
          eventType: dto.eventType,
          channel: dto.channel as NotificationChannel,
          subject: dto.subject ?? null,
          body: dto.body,
        },
        update: {
          subject: dto.subject ?? null,
          body: dto.body,
        },
      }),
    );
  }

  async listWebhookConfigs(actor: RequestUser) {
    this.assertAdmin(actor);
    return serializeNotificationValue(
      await this.prisma.tenant.webhookConfig.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
    );
  }

  async createWebhookConfig(actor: RequestUser, dto: UpsertWebhookConfigDto) {
    this.assertAdmin(actor);
    return serializeNotificationValue(
      await this.prisma.tenant.webhookConfig.create({
        data: {
          tenantId: this.requireTenantId(),
          url: dto.url.trim(),
          secret: dto.secret.trim(),
          events: dto.events,
          isActive: dto.isActive ?? true,
        },
      }),
    );
  }

  async updateWebhookConfig(
    id: string,
    actor: RequestUser,
    dto: UpsertWebhookConfigDto,
  ) {
    this.assertAdmin(actor);
    const existing = await this.prisma.tenant.webhookConfig.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new NotFoundException("Webhook config not found.");
    }

    return serializeNotificationValue(
      await this.prisma.tenant.webhookConfig.update({
        where: { id },
        data: {
          url: dto.url.trim(),
          secret: dto.secret.trim(),
          events: dto.events,
          isActive: dto.isActive ?? existing.isActive,
        },
      }),
    );
  }

  private requireActor(actor?: RequestUser | null) {
    if (!actor?.userId) {
      throw new NotificationActorRequiredException();
    }
    return actor;
  }

  private assertAdmin(actor?: RequestUser | null) {
    const currentActor = this.requireActor(actor);
    if (!currentActor.roles?.includes("tenant_admin")) {
      throw new NotificationAdminAccessException();
    }
    return currentActor;
  }

  private requireTenantId() {
    const tenantId = this.cls.get<string>("tenantId");
    if (!tenantId || tenantId === "*") {
      throw new BadRequestException(
        "Notification endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }
}
