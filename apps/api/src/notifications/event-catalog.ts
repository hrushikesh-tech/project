import { NotificationChannel } from "@amdox/db";
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationEventCatalogEntry,
  NotificationEventType,
} from "@amdox/types";

type CatalogRecord = Record<
  NotificationEventType,
  NotificationEventCatalogEntry
>;

const catalog: CatalogRecord = {
  "invoice.match_failed": {
    eventType: "invoice.match_failed",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
    legacyInAppNotification: true,
  },
  "hr.leave.rejected": {
    eventType: "hr.leave.rejected",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
    legacyInAppNotification: true,
  },
  "payroll.run.completed": {
    eventType: "payroll.run.completed",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
  },
  "payroll.run.failed": {
    eventType: "payroll.run.failed",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
  },
  "supply-chain.reorder.skipped": {
    eventType: "supply-chain.reorder.skipped",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
  },
  "bi.report.ready": {
    eventType: "bi.report.ready",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
    legacyInAppNotification: true,
  },
  "project.budget.overrun": {
    eventType: "project.budget.overrun",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.WEBHOOK,
    ],
    legacyInAppNotification: true,
  },
  "invoice.posted": {
    eventType: "invoice.posted",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "invoice.overdue": {
    eventType: "invoice.overdue",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "invoice.review.required": {
    eventType: "invoice.review.required",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "purchase-order.submitted": {
    eventType: "purchase-order.submitted",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "purchase-order.approved": {
    eventType: "purchase-order.approved",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "inventory.low-stock": {
    eventType: "inventory.low-stock",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WEBHOOK,
    ],
    futureFacing: true,
  },
  "inventory.receipt.posted": {
    eventType: "inventory.receipt.posted",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "forecast.generated": {
    eventType: "forecast.generated",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WEBHOOK,
    ],
    futureFacing: true,
  },
  "forecast.model.promoted": {
    eventType: "forecast.model.promoted",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WEBHOOK,
    ],
    futureFacing: true,
  },
  "dashboard.shared": {
    eventType: "dashboard.shared",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "report.schedule.failed": {
    eventType: "report.schedule.failed",
    channels: [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
      NotificationChannel.WEBHOOK,
    ],
    futureFacing: true,
  },
  "project.milestone.completed": {
    eventType: "project.milestone.completed",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "project.task.blocked": {
    eventType: "project.task.blocked",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "user.invited": {
    eventType: "user.invited",
    channels: [NotificationChannel.EMAIL],
    futureFacing: true,
  },
  "user.deactivated": {
    eventType: "user.deactivated",
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    futureFacing: true,
  },
};

export function listNotificationCatalogEntries() {
  return NOTIFICATION_EVENT_TYPES.map((eventType) => catalog[eventType]);
}

export function getNotificationCatalogEntry(eventType: string) {
  return catalog[eventType as NotificationEventType] ?? null;
}

export function isNotificationEventType(
  eventType: string,
): eventType is NotificationEventType {
  return Boolean(catalog[eventType as NotificationEventType]);
}
