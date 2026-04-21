import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createNotificationsHarness } from "../helpers/notifications-test-store.mjs";

const require = createRequire(import.meta.url);
const {
  NotificationDeliveryService,
} = require("../../dist/src/notifications/notification-delivery.service.js");
const {
  TemplateRendererService,
} = require("../../dist/src/notifications/template-renderer.service.js");
const {
  InAppChannelService,
} = require("../../dist/src/notifications/channels/in-app-channel.service.js");
const {
  SmsChannelService,
} = require("../../dist/src/notifications/channels/sms-channel.service.js");
const {
  OutboxPollerService,
} = require("../../dist/src/notifications/outbox-poller.service.js");

function createConfigService(values = {}) {
  return {
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : fallback;
    },
  };
}

test("notification engine processes completed-phase events and avoids duplicate legacy in-app rows", async () => {
  const harness = createNotificationsHarness();
  const financeUser = harness.insertUser({
    id: "finance-user",
    role: "finance_manager",
    email: "finance@amdox.dev",
  });
  const leaveEmployeeUser = harness.insertUser({
    id: "leave-user",
    role: "viewer",
    email: "leave@amdox.dev",
  });
  const tenantAdmin = harness.insertUser({
    id: "tenant-admin",
    role: "tenant_admin",
    email: "admin@amdox.dev",
  });
  const hrManager = harness.insertUser({
    id: "hr-manager",
    role: "hr_manager",
    email: "hr@amdox.dev",
  });
  const supplyManager = harness.insertUser({
    id: "supply-manager",
    role: "supply_chain_manager",
    email: "supply@amdox.dev",
  });
  const projectManager = harness.insertUser({
    id: "project-manager",
    role: "project_manager",
    email: "pm@amdox.dev",
  });

  const leaveEmployee = harness.insertEmployee({
    userId: leaveEmployeeUser.id,
    email: leaveEmployeeUser.email,
    phone: "+15550000001",
    status: "ACTIVE",
  });
  harness.insertEmployee({
    userId: financeUser.id,
    email: financeUser.email,
    phone: "+15550000002",
    status: "ACTIVE",
  });
  harness.insertEmployee({
    userId: tenantAdmin.id,
    email: tenantAdmin.email,
    phone: "+15550000003",
    status: "ACTIVE",
  });
  harness.insertEmployee({
    userId: hrManager.id,
    email: hrManager.email,
    phone: "+15550000004",
    status: "ACTIVE",
  });
  harness.insertEmployee({
    userId: supplyManager.id,
    email: supplyManager.email,
    phone: "+15550000005",
    status: "ACTIVE",
  });
  const projectManagerEmployee = harness.insertEmployee({
    userId: projectManager.id,
    email: projectManager.email,
    phone: "+15550000006",
    status: "ACTIVE",
  });

  harness.insertWebhookConfig({
    id: "webhook-1",
    url: "https://example.com/hooks/all",
    secret: "webhook-secret",
    events: [
      "invoice.match_failed",
      "hr.leave.rejected",
      "payroll.run.completed",
      "payroll.run.failed",
      "supply-chain.reorder.skipped",
      "bi.report.ready",
      "project.budget.overrun",
    ],
  });

  const queue = {
    jobs: [],
    async enqueueDelivery(payload) {
      this.jobs.push(payload);
    },
  };
  const emailChannel = {
    sent: [],
    async deliver(params) {
      this.sent.push(params);
      return {
        channel: "EMAIL",
        status: "DELIVERED",
        recipientCount: params.recipients.length,
      };
    },
  };
  const webhookChannel = {
    sent: [],
    async deliver(params) {
      this.sent.push(params);
      return {
        channel: "WEBHOOK",
        status: "DELIVERED",
        recipientCount: params.endpoints.length,
      };
    },
  };

  const deliveryService = new NotificationDeliveryService(
    harness.prisma,
    new TemplateRendererService(harness.prisma),
    new InAppChannelService(),
    emailChannel,
    new SmsChannelService(createConfigService()),
    webhookChannel,
  );
  const poller = new OutboxPollerService(harness.prisma, queue);

  const biSchedule = harness.insertReportSchedule({
    recipients: [tenantAdmin.email],
  });
  const biRun = harness.insertReportRun({
    reportScheduleId: biSchedule.id,
    dashboardId: biSchedule.dashboardId,
  });

  const outboxEvents = [
    harness.insertOutboxEvent({
      id: "outbox-invoice",
      eventType: "invoice.match_failed",
      payload: {
        invoiceId: "invoice-100",
        mismatchReasons: ["quantity mismatch"],
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-leave",
      eventType: "hr.leave.rejected",
      payload: {
        leaveRequestId: "leave-1",
        employeeId: leaveEmployee.id,
        reason: "Manager rejected the leave request.",
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-payroll-completed",
      eventType: "payroll.run.completed",
      payload: {
        payrollRunId: "run-100",
        message: "Payroll completed successfully.",
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-payroll-failed",
      eventType: "payroll.run.failed",
      payload: {
        payrollRunId: "run-101",
        message: "Payroll failed.",
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-supply",
      eventType: "supply-chain.reorder.skipped",
      payload: {
        productId: "product-100",
        message: "Vendor is blocked.",
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-bi",
      eventType: "bi.report.ready",
      payload: {
        reportRunId: biRun.id,
        dashboardId: biSchedule.dashboardId,
        recipients: [tenantAdmin.email],
      },
    }),
    harness.insertOutboxEvent({
      id: "outbox-project",
      eventType: "project.budget.overrun",
      payload: {
        projectId: "project-1",
        projectCode: "PM-1",
        thresholdPercent: 10,
        recipients: [tenantAdmin.id, projectManager.id],
      },
    }),
  ];

  await poller.pollOnce();
  assert.equal(queue.jobs.length, outboxEvents.length);
  assert.ok(
    harness.state.outboxEvents.every((entry) => entry.status === "PROCESSING"),
  );

  for (const job of queue.jobs) {
    await deliveryService.processEvent(job);
  }

  const completedStatuses = new Map(
    harness.state.outboxEvents.map((entry) => [entry.id, entry.status]),
  );
  assert.equal(completedStatuses.get("outbox-invoice"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-leave"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-payroll-completed"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-payroll-failed"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-supply"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-bi"), "COMPLETED");
  assert.equal(completedStatuses.get("outbox-project"), "COMPLETED");

  assert.equal(
    harness.state.notifications.some((entry) => entry.type === "invoice.match_failed"),
    false,
  );
  assert.equal(
    harness.state.notifications.some(
      (entry) => entry.type === "supply-chain.reorder.skipped",
    ),
    true,
  );
  assert.equal(
    harness.state.notifications.some(
      (entry) => entry.type === "payroll.run.completed",
    ),
    true,
  );
  assert.ok(emailChannel.sent.length >= outboxEvents.length);
  assert.ok(webhookChannel.sent.length >= outboxEvents.length);
});

test("notification engine respects explicit preferences, applies template overrides, and records SMS skips", async () => {
  const harness = createNotificationsHarness();
  const tenantAdmin = harness.insertUser({
    id: "admin-user",
    role: "tenant_admin",
    email: "admin@amdox.dev",
  });
  const projectManager = harness.insertUser({
    id: "manager-user",
    role: "project_manager",
    email: "manager@amdox.dev",
  });
  harness.insertEmployee({
    userId: tenantAdmin.id,
    email: tenantAdmin.email,
    phone: "+15551000001",
    status: "ACTIVE",
  });
  harness.insertEmployee({
    userId: projectManager.id,
    email: projectManager.email,
    phone: "+15551000002",
    status: "ACTIVE",
  });
  harness.insertNotificationPreference({
    userId: projectManager.id,
    eventType: "project.budget.overrun",
    channel: "EMAIL",
    enabled: false,
  });
  harness.insertNotificationTemplate({
    eventType: "project.budget.overrun",
    channel: "EMAIL",
    subject: "Custom budget notice",
    body: "Custom overrun for {{projectCode}}.",
  });
  const event = harness.insertOutboxEvent({
    id: "project-alert-event",
    status: "PROCESSING",
    eventType: "project.budget.overrun",
    payload: {
      projectId: "project-1",
      projectCode: "PM-200",
      thresholdPercent: 10,
      recipients: [tenantAdmin.id, projectManager.id],
    },
  });

  const emailChannel = {
    sent: [],
    async deliver(params) {
      this.sent.push(params);
      return {
        channel: "EMAIL",
        status: "DELIVERED",
        recipientCount: params.recipients.length,
      };
    },
  };
  const deliveryService = new NotificationDeliveryService(
    harness.prisma,
    new TemplateRendererService(harness.prisma),
    new InAppChannelService(),
    emailChannel,
    new SmsChannelService(createConfigService()),
    {
      async deliver() {
        return {
          channel: "WEBHOOK",
          status: "SKIPPED",
          recipientCount: 0,
          detail: "No active webhook endpoints configured.",
        };
      },
    },
  );

  await deliveryService.processEvent({
    tenantId: "tenant-1",
    eventId: event.id,
  });

  assert.equal(emailChannel.sent.length, 1);
  assert.deepEqual(emailChannel.sent[0].recipients, [tenantAdmin.email]);
  assert.equal(emailChannel.sent[0].subject, "Custom budget notice");
  assert.equal(emailChannel.sent[0].body, "Custom overrun for PM-200.");

  const updated = harness.state.outboxEvents.find((entry) => entry.id === event.id);
  assert.equal(updated.status, "COMPLETED");
  assert.equal(updated.deliveryState.channels.SMS.status, "SKIPPED");
  assert.equal(
    updated.deliveryState.channels.SMS.detail,
    "SMS provider is not configured.",
  );
});
