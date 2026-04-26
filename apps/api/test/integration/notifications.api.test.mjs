import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createNotificationsHarness } from "../helpers/notifications-test-store.mjs";
import { configureApiPlatform, unwrapBody } from "../helpers/app-platform.mjs";

const require = createRequire(import.meta.url);
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { ValidationPipe } = require("@nestjs/common");
const { Reflector } = require("@nestjs/core");
const { ClsService } = require("nestjs-cls");
const { PrismaService } = require("../../dist/src/prisma/prisma.service.js");
const {
  NotificationsController,
} = require("../../dist/src/notifications/notifications.controller.js");
const {
  NotificationsService,
} = require("../../dist/src/notifications/notifications.service.js");
const {
  TemplateRendererService,
} = require("../../dist/src/notifications/template-renderer.service.js");
const {
  NotificationsExceptionFilter,
} = require("../../dist/src/notifications/notifications-exception.filter.js");
const {
  TenantGuard,
} = require("../../dist/src/common/guards/tenant.guard.js");
const {
  RolesGuard,
} = require("../../dist/src/common/guards/roles.guard.js");

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      NotificationsService,
      TemplateRendererService,
      { provide: PrismaService, useValue: harness.prisma },
      { provide: ClsService, useValue: harness.cls },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    const rolesHeader = req.headers["x-roles"];
    req.user = {
      userId:
        typeof req.headers["x-user-id"] === "string"
          ? req.headers["x-user-id"]
          : "viewer-user",
      email:
        typeof req.headers["x-user-email"] === "string"
          ? req.headers["x-user-email"]
          : "viewer@amdox.dev",
      roles:
        typeof rolesHeader === "string"
          ? rolesHeader.split(",").map((value) => value.trim()).filter(Boolean)
          : ["viewer"],
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
  app.useGlobalFilters(new NotificationsExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await configureApiPlatform(app);
  return app;
}

test("notifications api supports inbox, default-on preferences, templates, and webhook configs", async () => {
  const harness = createNotificationsHarness();
  const viewerUser = harness.insertUser({
    id: "viewer-user",
    role: "viewer",
    email: "viewer@amdox.dev",
  });
  const tenantAdmin = harness.insertUser({
    id: "tenant-admin-user",
    role: "tenant_admin",
    email: "admin@amdox.dev",
  });
  harness.insertNotification({
    id: "notification-1",
    userId: viewerUser.id,
    type: "invoice.match_failed",
    channel: "IN_APP",
    title: "Invoice review required",
    body: "Invoice needs review",
  });

  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const inbox = await api
    .get("/api/v1/notifications?unreadOnly=true")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer");
  assert.equal(inbox.status, 200);
  assert.equal(unwrapBody(inbox).length, 1);

  const marked = await api
    .patch("/api/v1/notifications/notification-1/read")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer");
  assert.equal(marked.status, 200);
  assert.equal(unwrapBody(marked).isRead, true);

  const defaultPreferences = await api
    .get("/api/v1/notifications/preferences?eventType=invoice.match_failed")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer");
  assert.equal(defaultPreferences.status, 200);
  const emailPreference = unwrapBody(defaultPreferences).find(
    (entry) => entry.channel === "EMAIL",
  );
  assert.equal(emailPreference.enabled, true);
  assert.equal(emailPreference.explicit, false);

  const updatedPreference = await api
    .put("/api/v1/notifications/preferences")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer")
    .send({
      eventType: "invoice.match_failed",
      channel: "EMAIL",
      enabled: false,
    });
  assert.equal(updatedPreference.status, 200);

  const explicitPreferences = await api
    .get("/api/v1/notifications/preferences?eventType=invoice.match_failed")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer");
  const explicitEmailPreference = unwrapBody(explicitPreferences).find(
    (entry) => entry.channel === "EMAIL",
  );
  assert.equal(explicitEmailPreference.enabled, false);
  assert.equal(explicitEmailPreference.explicit, true);

  const platformTemplate = await api
    .get(
      "/api/v1/notifications/templates?eventType=project.budget.overrun&channel=EMAIL",
    )
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin");
  assert.equal(platformTemplate.status, 200);
  assert.equal(unwrapBody(platformTemplate)[0].source, "PLATFORM_DEFAULT");

  const overriddenTemplate = await api
    .put("/api/v1/notifications/templates")
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin")
    .send({
      eventType: "project.budget.overrun",
      channel: "EMAIL",
      subject: "Custom overrun",
      body: "Project {{projectCode}} crossed the budget.",
    });
  assert.equal(overriddenTemplate.status, 200);

  const effectiveTemplate = await api
    .get(
      "/api/v1/notifications/templates?eventType=project.budget.overrun&channel=EMAIL",
    )
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin");
  assert.equal(unwrapBody(effectiveTemplate)[0].source, "TENANT_OVERRIDE");
  assert.equal(unwrapBody(effectiveTemplate)[0].subject, "Custom overrun");

  const createWebhook = await api
    .post("/api/v1/notifications/webhooks")
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin")
    .send({
      url: "https://example.com/hooks/project",
      secret: "project-secret",
      events: ["project.budget.overrun"],
      isActive: true,
    });
  assert.equal(createWebhook.status, 201);

  const listWebhooks = await api
    .get("/api/v1/notifications/webhooks")
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin");
  assert.equal(listWebhooks.status, 200);
  assert.equal(unwrapBody(listWebhooks).length, 1);

  const updatedWebhook = await api
    .patch(`/api/v1/notifications/webhooks/${unwrapBody(createWebhook).id}`)
    .set("x-user-id", tenantAdmin.id)
    .set("x-user-email", tenantAdmin.email)
    .set("x-roles", "tenant_admin")
    .send({
      url: "https://example.com/hooks/project",
      secret: "project-secret",
      events: ["project.budget.overrun"],
      isActive: false,
    });
  assert.equal(updatedWebhook.status, 200);
  assert.equal(unwrapBody(updatedWebhook).isActive, false);

  const forbidden = await api
    .post("/api/v1/notifications/webhooks")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer")
    .send({
      url: "https://example.com/hooks/blocked",
      secret: "blocked",
      events: ["project.budget.overrun"],
      isActive: true,
    });
  assert.equal(forbidden.status, 403);

  const crossTenant = await api
    .get("/api/v1/notifications")
    .set("x-user-id", viewerUser.id)
    .set("x-user-email", viewerUser.email)
    .set("x-roles", "viewer")
    .set("x-auth-tenant", "tenant-1")
    .set("x-tenant-id", "tenant-2");
  assert.equal(crossTenant.status, 403);

  await app.close();
});
