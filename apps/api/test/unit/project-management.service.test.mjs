import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createProjectManagementHarness } from "../helpers/project-management-test-store.mjs";

const require = createRequire(import.meta.url);
const {
  CircularDependencyException,
} = require("@amdox/types");
const {
  ProjectManagementService,
} = require("../../dist/src/project-management/project-management.service.js");
const {
  ProjectDependencyService,
} = require("../../dist/src/project-management/project-dependency.service.js");
const {
  ProjectBudgetAlertService,
} = require("../../dist/src/project-management/project-budget-alert.service.js");

function createService(harness) {
  return new ProjectManagementService(
    harness.prisma,
    harness.cls,
    new ProjectDependencyService(),
    new ProjectBudgetAlertService(),
  );
}

test("project management rejects circular task dependencies", async () => {
  const harness = createProjectManagementHarness();
  const service = createService(harness);
  const managerUser = harness.insertUser({
    id: "pm-manager-user",
    role: "project_manager",
  });
  const manager = harness.insertEmployee({
    userId: managerUser.id,
    status: "ACTIVE",
  });
  const project = harness.insertProject({
    managerId: manager.id,
    code: "PM-CYCLE",
  });
  const taskA = harness.insertTask({ projectId: project.id, name: "Task A" });
  const taskB = harness.insertTask({ projectId: project.id, name: "Task B" });
  const taskC = harness.insertTask({ projectId: project.id, name: "Task C" });

  await service.createTaskDependency({
    taskId: taskB.id,
    dependsOnTaskId: taskA.id,
    type: "FINISH_TO_START",
  });
  await service.createTaskDependency({
    taskId: taskC.id,
    dependsOnTaskId: taskB.id,
    type: "FINISH_TO_START",
  });

  await assert.rejects(
    () =>
      service.createTaskDependency({
        taskId: taskA.id,
        dependsOnTaskId: taskC.id,
        type: "FINISH_TO_START",
      }),
    (error) => error instanceof CircularDependencyException,
  );
});

test("project management emits a single budget overrun alert on threshold crossing", async () => {
  const harness = createProjectManagementHarness();
  const service = createService(harness);
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
  const project = harness.insertProject({
    managerId: manager.id,
    budget: 100000n,
    actualCost: 100000n,
  });

  await service.updateProject(project.id, { actualCost: 110000 });

  assert.equal(harness.state.outboxEvents.length, 1);
  assert.equal(harness.state.outboxEvents[0].eventType, "project.budget.overrun");
  assert.deepEqual(
    harness.state.notifications.map((entry) => entry.userId).sort(),
    [managerUser.id, tenantAdmin.id].sort(),
  );

  await service.updateProject(project.id, { actualCost: 120000 });

  assert.equal(harness.state.outboxEvents.length, 1);
});

test("project management utilization returns allocated vs available hours", async () => {
  const harness = createProjectManagementHarness();
  const service = createService(harness);
  const manager = harness.insertEmployee({ status: "ACTIVE" });
  const employee = harness.insertEmployee({
    status: "ACTIVE",
  });
  const leaveType = harness.insertLeaveType({ code: "AL", name: "Annual Leave" });
  const project = harness.insertProject({
    managerId: manager.id,
    code: "PM-UTIL",
  });

  harness.insertTask({
    projectId: project.id,
    assigneeId: employee.id,
    estimatedHours: "12",
    status: "IN_PROGRESS",
  });
  harness.insertTask({
    projectId: project.id,
    assigneeId: employee.id,
    estimatedHours: "4",
    status: "TODO",
  });
  harness.insertLeaveRequest({
    employeeId: employee.id,
    leaveTypeId: leaveType.id,
    startDate: new Date("2026-04-08T00:00:00.000Z"),
    endDate: new Date("2026-04-08T00:00:00.000Z"),
    status: "APPROVED",
  });

  const [row] = await service.getUtilization({
    startDate: "2026-04-06",
    endDate: "2026-04-10",
    employeeId: employee.id,
  });

  assert.equal(row.allocatedHours, 16);
  assert.equal(row.availableHours, 32);
  assert.equal(row.utilizationPercent, 50);
});

test("project milestones complete when all linked tasks are done", async () => {
  const harness = createProjectManagementHarness();
  const service = createService(harness);
  const manager = harness.insertEmployee({ status: "ACTIVE" });
  const project = harness.insertProject({
    managerId: manager.id,
    code: "PM-MILESTONE",
  });
  const milestone = harness.insertProjectMilestone({
    projectId: project.id,
    name: "Go Live",
  });
  const firstTask = harness.insertTask({
    projectId: project.id,
    milestoneId: milestone.id,
    name: "Task 1",
    status: "TODO",
  });
  const secondTask = harness.insertTask({
    projectId: project.id,
    milestoneId: milestone.id,
    name: "Task 2",
    status: "TODO",
  });

  await service.updateTask(firstTask.id, { status: "DONE" });
  const afterFirstUpdate = await service.getMilestone(milestone.id);
  assert.equal(afterFirstUpdate.status, "PENDING");

  await service.updateTask(secondTask.id, { status: "DONE" });
  const afterSecondUpdate = await service.getMilestone(milestone.id);
  assert.equal(afterSecondUpdate.status, "COMPLETED");
});
