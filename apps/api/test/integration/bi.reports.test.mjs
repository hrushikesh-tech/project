import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import { ConfigService } from "@nestjs/config";
import { ClsService } from "nestjs-cls";
import { createBiHarness } from "../helpers/bi-test-store.mjs";

const require = createRequire(import.meta.url);
const { BiMetricsService } = require("../../dist/src/bi/metrics/bi-metrics.service.js");
const { BiReportPdfService } = require("../../dist/src/bi/reports/bi-report-pdf.service.js");
const { BiReportExcelService } = require("../../dist/src/bi/reports/bi-report-excel.service.js");
const { BiReportStorageService } = require("../../dist/src/bi/reports/bi-report-storage.service.js");
const { BiReportMailerService } = require("../../dist/src/bi/reports/bi-report-mailer.service.js");
const { BiReportService } = require("../../dist/src/bi/reports/bi-report.service.js");

test("BI report execution renders PDF/Excel artifacts and records run metadata", async (t) => {
  const harness = createBiHarness();
  const owner = harness.insertUser({ id: "report-owner", role: "tenant_admin" });
  const dashboard = harness.insertDashboard({
    ownerId: owner.id,
    title: "Ops Dashboard",
    isPublic: false,
  });
  harness.insertWidget({
    dashboardId: dashboard.id,
    title: "Project budget",
    metricKey: "project_budget_vs_actual",
    type: "TABLE",
    position: { x: 0, y: 0, w: 6, h: 4 },
  });
  harness.insertProject({
    code: "OPS-1",
    name: "Ops Program",
    budget: 200000n,
    actualCost: 150000n,
  });
  const schedule = harness.insertReportSchedule({
    dashboardId: dashboard.id,
    recipients: ["ops@amdox.dev"],
    formats: ["PDF", "EXCEL"],
  });

  let uploads = [];
  const server = http.createServer((req, res) => {
    uploads.push({
      method: req.method,
      url: req.url,
      contentType: req.headers["content-type"],
    });
    req.resume();
    req.on("end", () => {
      res.statusCode = 200;
      res.setHeader("etag", '"test"');
      res.end();
    });
  });
  t.after(async () => {
    server.close();
    await once(server, "close");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const config = new ConfigService({
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "test-bucket",
    AWS_ACCESS_KEY_ID: "testing",
    AWS_SECRET_ACCESS_KEY: "testing",
    AWS_S3_ENDPOINT: `http://127.0.0.1:${port}`,
    AWS_S3_FORCE_PATH_STYLE: "true",
    BI_REPORT_ARTIFACT_PREFIX: "bi-reports",
    BI_REPORT_BASE_URL: `http://127.0.0.1:${port}/downloads`,
    REPORT_FROM_EMAIL: "reports@amdox.local",
    SMTP_HOST: "",
  });

  const reportService = new BiReportService(
    harness.prisma,
    harness.cls,
    new BiMetricsService(harness.prisma),
    new BiReportPdfService(),
    new BiReportExcelService(),
    new BiReportStorageService(config),
    new BiReportMailerService(config),
    {
      async registerSchedule() {},
      async syncSchedule() {},
    },
  );

  const result = await reportService.executeSchedule(schedule.id, "tenant-1", owner.id);

  assert.equal(result.artifacts.length, 2);
  assert.equal(uploads.length, 2);
  assert.equal(harness.state.reportRuns.length, 1);
  assert.equal(harness.state.reportRuns[0].status, "COMPLETED");
  assert.equal(harness.state.outboxEvents.length, 1);
  assert.equal(harness.state.notifications.length, 1);
  assert.equal(result.artifacts[0].url.includes("/downloads/"), true);
});
