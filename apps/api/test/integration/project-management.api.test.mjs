import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createProjectManagementHarness } from "../helpers/project-management-test-store.mjs";

const require = createRequire(import.meta.url);
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { ValidationPipe } = require("@nestjs/common");
const { Reflector } = require("@nestjs/core");
const { ClsService } = require("nestjs-cls");
const { PrismaService } = require("../../dist/src/prisma/prisma.service.js");
const {
  ProjectManagementController,
} = require("../../dist/src/project-management/project-management.controller.js");
const {
  ProjectManagementService,
} = require("../../dist/src/project-management/project-management.service.js");
const {
  ProjectDependencyService,
} = require("../../dist/src/project-management/project-dependency.service.js");
const {
  ProjectBudgetAlertService,
} = require("../../dist/src/project-management/project-budget-alert.service.js");
const {
  ProjectManagementExceptionFilter,
} = require("../../dist/src/project-management/project-management-exception.filter.js");
const {
  TenantGuard,
} = require("../../dist/src/common/guards/tenant.guard.js");
const {
  RolesGuard,
} = require("../../dist/src/common/guards/roles.guard.js");

async function createApp(harness) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProjectManagementController],
    providers: [
      ProjectManagementService,
      ProjectDependencyService,
      ProjectBudgetAlertService,
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
          : "tenant-admin-user",
      email: "pm@amdox.dev",
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
  app.useGlobalFilters(new ProjectManagementExceptionFilter());
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

test("project management api supports CRUD, milestone updates, and dependency validation", async () => {
  const harness = createProjectManagementHarness();
  const tenantAdmin = harness.insertUser({
    id: "tenant-admin-user",
    role: "tenant_admin",
  });
  const managerUser = harness.insertUser({
    id: "project-manager-user",
    role: "project_manager",
  });
  const manager = harness.insertEmployee({
    userId: managerUser.id,
    status: "ACTIVE",
  });

  const app = await createApp(harness);
  const api = request(app.getHttpServer());

  const project = (
    await api.post("/api/v1/projects").send({
      code: "PM-API",
      name: "Project API",
      managerId: manager.id,
      budget: 100000,
      actualCost: 90000,
      status: "ACTIVE",
    })
  ).body;
  assert.equal(project.code, "PM-API");

  const milestone = (
    await api.post("/api/v1/projects/milestones").send({
      projectId: project.id,
      name: "Release",
      dueDate: "2026-06-01T00:00:00.000Z",
    })
  ).body;

  const taskOne = (
    await api.post("/api/v1/projects/tasks").send({
      projectId: project.id,
      milestoneId: milestone.id,
      name: "Backend",
      assigneeId: manager.id,
    })
  ).body;
  const taskTwo = (
    await api.post("/api/v1/projects/tasks").send({
      projectId: project.id,
      milestoneId: milestone.id,
      name: "Frontend",
      assigneeId: manager.id,
    })
  ).body;

  const dependency = await api.post("/api/v1/projects/dependencies").send({
    taskId: taskTwo.id,
    dependsOnTaskId: taskOne.id,
    type: "FINISH_TO_START",
  });
  assert.equal(dependency.status, 201);

  const cycle = await api.post("/api/v1/projects/dependencies").send({
    taskId: taskOne.id,
    dependsOnTaskId: taskTwo.id,
    type: "FINISH_TO_START",
  });
  assert.equal(cycle.status, 409);

  await api.patch(`/api/v1/projects/tasks/${taskOne.id}`).send({ status: "DONE" });
  let milestoneState = await api.get(`/api/v1/projects/milestones/${milestone.id}`);
  assert.equal(milestoneState.body.status, "PENDING");

  await api.patch(`/api/v1/projects/tasks/${taskTwo.id}`).send({ status: "DONE" });
  milestoneState = await api.get(`/api/v1/projects/milestones/${milestone.id}`);
  assert.equal(milestoneState.body.status, "COMPLETED");

  const projectUpdate = await api.patch(`/api/v1/projects/${project.id}`).send({
    actualCost: 110000,
  });
  assert.equal(projectUpdate.status, 200);
  assert.equal(harness.state.outboxEvents.length, 1);
  assert.deepEqual(
    harness.state.notifications.map((entry) => entry.userId).sort(),
    [managerUser.id, tenantAdmin.id].sort(),
  );

  await app.close();
});
