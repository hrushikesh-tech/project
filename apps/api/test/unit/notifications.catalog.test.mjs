import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createNotificationsHarness } from "../helpers/notifications-test-store.mjs";

const require = createRequire(import.meta.url);
const {
  listNotificationCatalogEntries,
  getNotificationCatalogEntry,
} = require("../../dist/src/notifications/event-catalog.js");
const {
  TemplateRendererService,
} = require("../../dist/src/notifications/template-renderer.service.js");

test("notification catalog includes completed-phase events and seeded future catalog coverage", async () => {
  const entries = listNotificationCatalogEntries();
  assert.ok(entries.length >= 20);
  assert.deepEqual(
    [
      "invoice.match_failed",
      "hr.leave.rejected",
      "payroll.run.completed",
      "payroll.run.failed",
      "supply-chain.reorder.skipped",
      "bi.report.ready",
      "project.budget.overrun",
    ].map((eventType) => getNotificationCatalogEntry(eventType)?.eventType),
    [
      "invoice.match_failed",
      "hr.leave.rejected",
      "payroll.run.completed",
      "payroll.run.failed",
      "supply-chain.reorder.skipped",
      "bi.report.ready",
      "project.budget.overrun",
    ],
  );
  assert.ok(
    entries.some(
      (entry) => entry.eventType === "inventory.low-stock" && entry.futureFacing,
    ),
  );
});

test("template renderer resolves tenant override before platform default", async () => {
  const harness = createNotificationsHarness();
  harness.insertNotificationTemplate({
    eventType: "project.budget.overrun",
    channel: "EMAIL",
    subject: "Custom project alert",
    body: "Budget crossed for {{projectCode}}.",
  });

  const renderer = new TemplateRendererService(harness.prisma);
  const custom = await renderer.resolve({
    tenantId: "tenant-1",
    eventType: "project.budget.overrun",
    channel: "EMAIL",
    variables: {
      projectCode: "PM-100",
    },
  });
  assert.equal(custom.source, "TENANT_OVERRIDE");
  assert.equal(custom.subject, "Custom project alert");
  assert.equal(custom.body, "Budget crossed for PM-100.");

  const fallback = await renderer.resolve({
    tenantId: "tenant-1",
    eventType: "payroll.run.failed",
    channel: "EMAIL",
    variables: {
      payrollRunId: "run-1",
      message: "Something failed.",
    },
  });
  assert.equal(fallback.source, "PLATFORM_DEFAULT");
  assert.equal(fallback.subject, "Payroll run failed");
  assert.match(fallback.body, /run-1/);
});
