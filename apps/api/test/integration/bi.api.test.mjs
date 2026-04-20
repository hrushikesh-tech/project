import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createBiHarness } from "../helpers/bi-test-store.mjs";

const require = createRequire(import.meta.url);
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { ValidationPipe } = require("@nestjs/common");
const { Reflector } = require("@nestjs/core");
const { ClsService } = require("nestjs-cls");
const { PrismaService } = require("../../dist/src/prisma/prisma.service.js");
const { BiController } = require("../../dist/src/bi/bi.controller.js");
const { BiService } = require("../../dist/src/bi/bi.service.js");
const { BiMetricsService } = require("../../dist/src/bi/metrics/bi-metrics.service.js");
const { BiRefreshService } = require("../../dist/src/bi/bi-refresh.service.js");
const { BiReportService } = require("../../dist/src/bi/reports/bi-report.service.js");
const { BiReportPdfService } = require("../../dist/src/bi/reports/bi-report-pdf.service.js");
const { BiReportExcelService } = require("../../dist/src/bi/reports/bi-report-excel.service.js");
const { BiReportStorageService } = require("../../dist/src/bi/reports/bi-report-storage.service.js");
const { BiReportMailerService } = require("../../dist/src/bi/reports/bi-report-mailer.service.js");
const { BiReportQueue } = require("../../dist/src/bi/queue/bi-report.queue.js");
const { BiExceptionFilter } = require("../../dist/src/bi/bi-exception.filter.js");
const { TenantGuard } = require("../../dist/src/common/guards/tenant.guard.js");
const { RolesGuard } = require("../../dist/src/common/guards/roles.guard.js");
const { ConfigService } = require("@nestjs/config");
const { AccountType } = require("@amdox/db");

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [BiController],
    providers: [
      BiService,
      BiMetricsService,
      BiRefreshService,
      BiReportService,
      BiReportPdfService,
      BiReportExcelService,
      BiReportStorageService,
      BiReportMailerService,
      {
        provide: BiReportQueue,
        useValue: {
          async registerSchedule() {},
          async syncSchedule() {},
        },
      },
      { provide: PrismaService, useValue: harness.prisma },
      { provide: ClsService, useValue: harness.cls },
      {
        provide: ConfigService,
        useValue: {
          get(key, fallback) {
            const values = {
              AWS_REGION: "us-east-1",
              AWS_S3_BUCKET: "test-bucket",
              AWS_ACCESS_KEY_ID: "testing",
              AWS_SECRET_ACCESS_KEY: "testing",
              AWS_S3_ENDPOINT: "http://127.0.0.1:9999",
              AWS_S3_FORCE_PATH_STYLE: "true",
              BI_REPORT_ARTIFACT_PREFIX: "bi-reports",
              REPORT_FROM_EMAIL: "reports@amdox.local",
              SMTP_HOST: "",
            };
            return values[key] ?? fallback;
          },
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers["x-roles"];
    req.user = {
      userId:
        typeof req.headers["x-user-id"] === "string"
          ? req.headers["x-user-id"]
          : "bi-user",
      email: "bi@amdox.dev",
      roles:
        typeof rolesHeader === "string"
          ? rolesHeader.split(",").map((value) => value.trim()).filter(Boolean)
          : ["tenant_admin"],
      tenantId:
        typeof req.headers["x-auth-tenant"] === "string"
          ? req.headers["x-auth-tenant"]
          : "tenant-1",
    };
    next();
  });
  app.useGlobalGuards(
    new TenantGuard(harness.cls, new Reflector()),
    new RolesGuard(new Reflector()),
  );
  app.useGlobalFilters(new BiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

test("BI API supports dashboard CRUD, widget data, and tenant-public access", async () => {
  const harness = createBiHarness();
  const owner = harness.insertUser({ id: "bi-owner", role: "tenant_admin" });
  const legalEntity = harness.insertLegalEntity({ code: "BI", baseCurrency: "INR" });
  const revenueAccount = harness.insertAccount({
    legalEntityId: legalEntity.id,
    code: "REV-BI",
    name: "BI Revenue",
    type: AccountType.REVENUE,
  });
  const period = harness.insertPeriod({
    legalEntityId: legalEntity.id,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z"),
  });
  harness.insertJournalEntry({
    legalEntityId: legalEntity.id,
    periodId: period.id,
    status: "POSTED",
    date: new Date("2026-04-12T00:00:00.000Z"),
    lines: [{ accountId: revenueAccount.id, debit: 0n, credit: 100000n }],
  });

  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const createdDashboard = (
    await api
      .post("/api/v1/bi/dashboards")
      .set("x-user-id", owner.id)
      .send({ title: "Executive BI", isPublic: true })
  ).body;
  assert.equal(createdDashboard.title, "Executive BI");

  const widget = (
    await api
      .post(`/api/v1/bi/dashboards/${createdDashboard.id}/widgets`)
      .set("x-user-id", owner.id)
      .send({
        title: "Revenue",
        type: "BAR_CHART",
        metricKey: "revenue_by_month",
        position: { x: 0, y: 0, w: 4, h: 3 },
        config: {
          filters: {
            legalEntityId: legalEntity.id,
          },
        },
      })
  ).body;
  assert.equal(widget.metricKey, "revenue_by_month");

  const data = await api
    .get(`/api/v1/bi/dashboards/${createdDashboard.id}/data`)
    .set("x-user-id", "viewer-user")
    .set("x-roles", "viewer");
  assert.equal(data.status, 200);
  assert.equal(data.body.widgets[0].result.summary.value, 100000);

  const dashboards = await api
    .get("/api/v1/bi/dashboards")
    .set("x-user-id", "viewer-user")
    .set("x-roles", "viewer");
  assert.equal(dashboards.status, 200);
  assert.equal(dashboards.body.length, 1);

  await app.close();
});
