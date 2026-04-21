export const NOTIFICATION_EVENT_TYPES = [
  "invoice.match_failed",
  "hr.leave.rejected",
  "payroll.run.completed",
  "payroll.run.failed",
  "supply-chain.reorder.skipped",
  "bi.report.ready",
  "project.budget.overrun",
  "invoice.posted",
  "invoice.overdue",
  "invoice.review.required",
  "purchase-order.submitted",
  "purchase-order.approved",
  "inventory.low-stock",
  "inventory.receipt.posted",
  "forecast.generated",
  "forecast.model.promoted",
  "dashboard.shared",
  "report.schedule.failed",
  "project.milestone.completed",
  "project.task.blocked",
  "user.invited",
  "user.deactivated",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export type NotificationRecipient = {
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type NotificationTemplateContent = {
  subject?: string | null;
  body: string;
};

export type NotificationChannelResultStatus =
  | "DELIVERED"
  | "SKIPPED"
  | "FAILED";

export type NotificationChannelResult = {
  channel: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";
  status: NotificationChannelResultStatus;
  recipientCount: number;
  detail?: string | null;
  retryable?: boolean;
};

export type NotificationEventCatalogEntry = {
  eventType: NotificationEventType;
  channels: Array<"IN_APP" | "EMAIL" | "SMS" | "WEBHOOK">;
  legacyInAppNotification?: boolean;
  futureFacing?: boolean;
};

export interface NotificationPreferenceRow {
  eventType: NotificationEventType;
  channel: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";
  enabled: boolean;
  explicit: boolean;
}

export interface NotificationWebhookPayload {
  eventType: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export class NotificationActorRequiredException extends Error {
  constructor(message = "Authenticated actor required for notification APIs.") {
    super(message);
    this.name = "NotificationActorRequiredException";
  }
}

export class NotificationAdminAccessException extends Error {
  constructor(
    message = "Notification template and webhook management require tenant-admin access.",
  ) {
    super(message);
    this.name = "NotificationAdminAccessException";
  }
}
