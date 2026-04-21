import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@amdox/db";
import {
  NotificationChannelResult,
  NotificationEventType,
  NotificationRecipient,
  UserRole,
} from "@amdox/types";
import { PrismaService } from "../prisma/prisma.service";
import { getNotificationCatalogEntry } from "./event-catalog";
import { TemplateRendererService } from "./template-renderer.service";
import { InAppChannelService } from "./channels/in-app-channel.service";
import { EmailChannelService } from "./channels/email-channel.service";
import { SmsChannelService } from "./channels/sms-channel.service";
import { WebhookChannelService } from "./channels/webhook-channel.service";
import { serializeNotificationValue } from "./notifications.serialization";

type TenantPrisma = ReturnType<PrismaService["forTenant"]>;
type DeliveryState = {
  channels?: Partial<Record<string, NotificationChannelResult>>;
};

const MAX_RETRY_COUNT = 3;

@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateRenderer: TemplateRendererService,
    private readonly inAppChannelService: InAppChannelService,
    private readonly emailChannelService: EmailChannelService,
    private readonly smsChannelService: SmsChannelService,
    private readonly webhookChannelService: WebhookChannelService,
  ) {}

  async processEvent(params: { tenantId: string; eventId: string }) {
    const db = this.prisma.forTenant(params.tenantId);
    const event = await db.outboxEvent.findFirst({
      where: {
        id: params.eventId,
        deletedAt: null,
      },
    });

    if (!event) {
      return { skipped: true, reason: "event-not-found" };
    }

    const catalogEntry = getNotificationCatalogEntry(event.eventType);
    if (!catalogEntry) {
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "SKIPPED",
          processedAt: new Date(),
          lastError: "Unsupported notification event type.",
        },
      });
      return { skipped: true, reason: "unsupported-event" };
    }

    const priorState = this.parseDeliveryState(event.deliveryState);
    const context = await this.buildDeliveryContext(
      db,
      event.eventType as NotificationEventType,
      event.payload as Record<string, unknown>,
      params.tenantId,
    );

    const channelResults: NotificationChannelResult[] = [];
    for (const channel of catalogEntry.channels) {
      const previous = priorState.channels?.[channel];
      if (previous?.status === "DELIVERED" || previous?.status === "SKIPPED") {
        channelResults.push(previous);
        continue;
      }

      const result = await this.deliverChannel({
        db,
        tenantId: params.tenantId,
        eventType: event.eventType as NotificationEventType,
        channel,
        payload: event.payload as Record<string, unknown>,
        recipients: context.recipients,
        variables: context.variables,
        webhookConfigs: context.webhookConfigs,
        skipLegacyInApp: Boolean(catalogEntry.legacyInAppNotification),
      });
      channelResults.push(result);
    }

    const deliveryState: DeliveryState = {
      channels: Object.fromEntries(
        channelResults.map((result) => [result.channel, result]),
      ),
    };
    const retryableFailure = channelResults.find(
      (result) => result.status === "FAILED" && result.retryable,
    );
    const hasDelivered = channelResults.some(
      (result) => result.status === "DELIVERED",
    );
    const hasOnlySkipped = channelResults.every(
      (result) => result.status === "SKIPPED",
    );

    if (retryableFailure && event.retryCount + 1 < MAX_RETRY_COUNT) {
      const nextAttemptAt = new Date(
        Date.now() + Math.pow(2, event.retryCount) * 60_000,
      );
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PENDING",
          retryCount: event.retryCount + 1,
          nextAttemptAt,
          processingStartedAt: null,
          lastError: retryableFailure.detail ?? "Notification delivery failed.",
          deliveryState,
        },
      });
      return {
        retryScheduled: true,
        nextAttemptAt: nextAttemptAt.toISOString(),
      };
    }

    const terminalStatus = retryableFailure
      ? "FAILED"
      : hasOnlySkipped
        ? "SKIPPED"
        : hasDelivered
          ? "COMPLETED"
          : "FAILED";

    await db.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: terminalStatus,
        processedAt: new Date(),
        processingStartedAt: null,
        nextAttemptAt: null,
        lastError: retryableFailure?.detail ?? null,
        deliveryState,
      },
    });

    return serializeNotificationValue({
      eventId: event.id,
      status: terminalStatus,
      results: channelResults,
    });
  }

  private async deliverChannel(params: {
    db: TenantPrisma;
    tenantId: string;
    eventType: NotificationEventType;
    channel: NotificationChannel;
    payload: Record<string, unknown>;
    recipients: NotificationRecipient[];
    variables: Record<string, unknown>;
    webhookConfigs: Array<{ id: string; url: string; secret: string }>;
    skipLegacyInApp: boolean;
  }) {
    if (params.channel === NotificationChannel.WEBHOOK) {
      return this.webhookChannelService.deliver({
        endpoints: params.webhookConfigs,
        payload: {
          eventType: params.eventType,
          tenantId: params.tenantId,
          occurredAt: new Date().toISOString(),
          payload: params.payload,
        },
      });
    }

    const rendered = await this.templateRenderer.resolve({
      tenantId: params.tenantId,
      eventType: params.eventType,
      channel: params.channel,
      variables: params.variables,
    });
    if (!rendered) {
      return {
        channel: params.channel,
        status: "SKIPPED",
        recipientCount: 0,
        detail: "No template resolved for the channel.",
      };
    }

    const filteredRecipients = await this.applyPreferences(
      params.db,
      params.eventType,
      params.channel,
      params.recipients,
    );

    if (params.channel === NotificationChannel.IN_APP) {
      if (params.skipLegacyInApp) {
        return {
          channel: NotificationChannel.IN_APP,
          status: "SKIPPED",
          recipientCount: filteredRecipients.filter((entry) => entry.userId)
            .length,
          detail: "Legacy producer already created the in-app notification.",
        };
      }
      return this.inAppChannelService.deliver({
        db: params.db,
        tenantId: params.tenantId,
        eventType: params.eventType,
        title: rendered.subject ?? params.eventType,
        body: rendered.body,
        metadata: {
          eventType: params.eventType,
          payload: params.payload,
        },
        userIds: filteredRecipients
          .map((recipient) => recipient.userId)
          .filter((value): value is string => Boolean(value)),
      });
    }

    if (params.channel === NotificationChannel.EMAIL) {
      const emails = filteredRecipients
        .map((recipient) => recipient.email)
        .filter((value): value is string => Boolean(value));
      return this.emailChannelService.deliver({
        recipients: emails,
        subject: rendered.subject,
        body: rendered.body,
      });
    }

    const phones = filteredRecipients
      .map((recipient) => recipient.phone)
      .filter((value): value is string => Boolean(value));
    return this.smsChannelService.deliver({
      recipients: phones,
      body: rendered.body,
    });
  }

  private async applyPreferences(
    db: TenantPrisma,
    eventType: string,
    channel: NotificationChannel,
    recipients: NotificationRecipient[],
  ) {
    const userIds = recipients
      .map((recipient) => recipient.userId)
      .filter((value): value is string => Boolean(value));
    if (userIds.length === 0) {
      return recipients;
    }

    const preferences = await db.notificationPreference.findMany({
      where: {
        deletedAt: null,
        eventType,
        channel,
        userId: { in: userIds },
      },
    });
    const disabledUsers = new Set(
      preferences
        .filter((entry) => entry.enabled === false)
        .map((entry) => entry.userId),
    );

    return recipients.filter(
      (recipient) => !recipient.userId || !disabledUsers.has(recipient.userId),
    );
  }

  private async buildDeliveryContext(
    db: TenantPrisma,
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
    tenantId: string,
  ) {
    const recipients = await this.resolveRecipients(db, eventType, payload);
    const webhookConfigs = await db.webhookConfig.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    return {
      recipients,
      webhookConfigs: webhookConfigs
        .filter((entry) => entry.events.includes(eventType))
        .map((entry) => ({
          id: entry.id,
          url: entry.url,
          secret: entry.secret,
        })),
      variables: {
        ...payload,
        tenantId,
        mismatchReasons: Array.isArray(payload.mismatchReasons)
          ? payload.mismatchReasons.join(", ")
          : payload.mismatchReasons,
        reason: payload.reason ?? payload.message ?? "",
      },
    };
  }

  private async resolveRecipients(
    db: TenantPrisma,
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
  ) {
    switch (eventType) {
      case "invoice.match_failed":
        return this.resolveUsersByRoles(db, [UserRole.FINANCE_MANAGER]);
      case "hr.leave.rejected": {
        const employeeId =
          typeof payload.employeeId === "string" ? payload.employeeId : null;
        if (!employeeId) return [];
        const employee = await db.employee.findFirst({
          where: { id: employeeId, deletedAt: null },
        });
        return employee ? [this.toRecipient(employee)] : [];
      }
      case "payroll.run.completed":
      case "payroll.run.failed":
        return this.resolveUsersByRoles(db, [
          UserRole.TENANT_ADMIN,
          UserRole.HR_MANAGER,
          UserRole.FINANCE_MANAGER,
        ]);
      case "supply-chain.reorder.skipped":
        return this.resolveUsersByRoles(db, [
          UserRole.SUPPLY_CHAIN_MANAGER,
          UserRole.TENANT_ADMIN,
        ]);
      case "bi.report.ready": {
        const rawEmails = Array.isArray(payload.recipients)
          ? payload.recipients.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        const users = rawEmails.length
          ? await db.user.findMany({
              where: {
                deletedAt: null,
                isActive: true,
                email: { in: rawEmails },
              },
            })
          : [];
        const mapped = await this.attachPhonesToUsers(db, users);
        const unmatched = rawEmails
          .filter((email) => !mapped.some((entry) => entry.email === email))
          .map((email) => ({ email }));
        return [...mapped, ...unmatched];
      }
      case "project.budget.overrun": {
        const recipientIds = Array.isArray(payload.recipients)
          ? payload.recipients.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        const users = recipientIds.length
          ? await db.user.findMany({
              where: {
                deletedAt: null,
                isActive: true,
                id: { in: recipientIds },
              },
            })
          : [];
        return this.attachPhonesToUsers(db, users);
      }
      default:
        return [];
    }
  }

  private async resolveUsersByRoles(db: TenantPrisma, roles: string[]) {
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { in: roles },
      },
      orderBy: [{ createdAt: "asc" }],
    });
    return this.attachPhonesToUsers(db, users);
  }

  private async attachPhonesToUsers(
    db: TenantPrisma,
    users: Array<{ id: string; email: string }>,
  ) {
    if (users.length === 0) {
      return [];
    }

    const employees = await db.employee.findMany({
      where: {
        deletedAt: null,
        userId: { in: users.map((user) => user.id) },
      },
    });
    return users.map((user) => {
      const employee = employees.find((entry) => entry.userId === user.id);
      return {
        userId: user.id,
        email: user.email,
        phone: employee?.phone ?? null,
      };
    });
  }

  private toRecipient(employee: {
    userId?: string | null;
    email?: string | null;
    phone?: string | null;
  }) {
    return {
      userId: employee.userId ?? null,
      email: employee.email ?? null,
      phone: employee.phone ?? null,
    };
  }

  private parseDeliveryState(value: unknown): DeliveryState {
    if (!value || typeof value !== "object") {
      return {};
    }
    return value as DeliveryState;
  }
}
