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
  WebhookChannelService,
} = require("../../dist/src/notifications/channels/webhook-channel.service.js");

function createConfigService(values = {}) {
  return {
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : fallback;
    },
  };
}

test("notification delivery retries retryable failures with bounded bookkeeping", async () => {
  const harness = createNotificationsHarness();
  const financeUser = harness.insertUser({
    id: "finance-user",
    role: "finance_manager",
    email: "finance@amdox.dev",
  });
  harness.insertEmployee({
    userId: financeUser.id,
    email: financeUser.email,
    phone: "+15550001111",
    status: "ACTIVE",
  });
  const outboxEvent = harness.insertOutboxEvent({
    eventType: "invoice.match_failed",
    status: "PROCESSING",
    payload: {
      invoiceId: "invoice-1",
      mismatchReasons: ["quantity mismatch"],
    },
  });

  const deliveryService = new NotificationDeliveryService(
    harness.prisma,
    new TemplateRendererService(harness.prisma),
    new InAppChannelService(),
    {
      async deliver() {
        return {
          channel: "EMAIL",
          status: "FAILED",
          recipientCount: 1,
          detail: "smtp timeout",
          retryable: true,
        };
      },
    },
    new SmsChannelService(createConfigService()),
    {
      async deliver() {
        return {
          channel: "WEBHOOK",
          status: "SKIPPED",
          recipientCount: 0,
          detail: "no webhooks",
        };
      },
    },
  );

  const result = await deliveryService.processEvent({
    tenantId: "tenant-1",
    eventId: outboxEvent.id,
  });

  assert.equal(result.retryScheduled, true);
  const updated = harness.state.outboxEvents.find((entry) => entry.id === outboxEvent.id);
  assert.equal(updated.status, "PENDING");
  assert.equal(updated.retryCount, 1);
  assert.ok(updated.nextAttemptAt instanceof Date);
  assert.equal(updated.lastError, "smtp timeout");
});

test("webhook signatures are HMAC signed and timing-safe verifiable", async () => {
  const service = new WebhookChannelService();
  const payload = JSON.stringify({
    eventType: "project.budget.overrun",
    tenantId: "tenant-1",
  });
  const signature = service.createSignature("secret", payload);

  assert.equal(service.verifySignature("secret", payload, signature), true);
  assert.equal(service.verifySignature("wrong", payload, signature), false);
});
