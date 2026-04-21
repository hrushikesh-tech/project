# Phase 10: Project Management - Research

**Date:** 2026-04-21
**Phase:** 10-project-management
**Status:** Complete

## What This Phase Needs To Solve

Phase 10 has to turn the existing schema stubs for projects, tasks, dependencies, and milestones into a real backend project-management capability that:

- supports tenant-safe project, task, and milestone CRUD
- validates task dependencies as a DAG and throws `CircularDependencyException` on cycles
- keeps milestone completion derived from linked tasks instead of manual-only status edits
- exposes a planning-oriented resource-utilization query using task estimates plus HR availability rules
- fires a durable budget-overrun alert when `actualCost` first crosses the `>= 10%` threshold without waiting for Phase 11

The core design tension is that the schema already contains project records, but key semantics are still missing: manager ownership is not tied to `Employee`, milestones are not linked to tasks, and no current backend module owns dependency validation or utilization logic.

## Codebase Findings

### Existing assets that Phase 10 should reuse

- `packages/db/prisma/schema.prisma` already defines `Project`, `Task`, `TaskDependency`, and `ProjectMilestone`, so Phase 10 should evolve the existing models rather than introduce a parallel store.
- `packages/types/src/enums.ts` already defines `ProjectStatus`, `TaskStatus`, `TaskPriority`, `MilestoneStatus`, `DependencyType`, and `UserRole`, which is consistent with the repo's hybrid "string in Prisma, enum in app layer" pattern.
- `apps/api/src/hr/hr.service.ts` already encodes employee lifecycle, approved leave semantics, and active-roster rules that should drive manager validation and available-hours calculations.
- `apps/api/src/prisma/prisma.service.ts` already provides the required split between request-scoped tenant access and explicit `forTenant()` access for background or non-request work.
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` already demonstrates the repo's pattern for durable outbox-event creation when backend automation crosses a rule threshold.
- `apps/api/src/bi/metrics/bi-metrics.service.ts` already reads `Project.budget` and `Project.actualCost` directly, so Phase 10 must preserve that contract instead of moving cost into a separate derived store.

### Important gaps

- `Project.managerId` is a raw string today, not a real relation to `Employee`, which is inconsistent with the locked Phase 10 ownership decision.
- `Task` has no milestone linkage, so milestone status cannot currently derive from linked tasks.
- No project-management-specific exceptions exist yet in `packages/types`, even though Phase 10 requires `CircularDependencyException` and other project-domain validation errors.
- No `apps/api/src/project-management` module exists yet, so there is no domain-owned controller/service/filter surface for projects.
- `apps/api/test/helpers/bi-test-store.mjs` currently inserts projects with a user-backed `managerId`; that harness will drift immediately if Phase 10 correctly moves managers onto `Employee`.
- `apps/api/src/common/interceptors/audit.interceptor.ts` does not map project, task, or milestone routes for before-snapshot lookup today, so project mutations would get weaker audit coverage than existing modules.

## Recommended Technical Direction

### 1. Keep Project Management as a backend-owned vertical slice

Phase 10 should follow the same shape as HR, supply chain, and BI:

- `project-management.module.ts`
- `project-management.controller.ts`
- `project-management.service.ts`
- project-management DTOs
- project-specific exception filter
- optional focused helper services where the logic is clearly derived (`dependency`, `utilization`, `budget-alert`)

This fits the repo's NestJS conventions and keeps project rules from leaking into BI or HR modules.

### 2. Evolve the existing schema in place with explicit ownership and linkage

The simplest schema evolution that matches the locked context is:

- change `Project.managerId` into a real `Employee` relation
- add a reverse `managedProjects` relation on `Employee`
- add `Task.milestoneId` so one task links to one milestone in this phase
- keep `TaskDependency` as the dependency edge table

This is better than a join table because the user explicitly chose direct task-to-milestone linkage for Phase 10.

### 3. Treat dependency validation as a service-level rule, not a database trick

The repo already enforces domain behavior in services rather than controllers. Phase 10 should do the same:

- same-project validation happens before dependency creation
- cycle detection runs against the current task graph plus the proposed edge
- all dependency types in `DependencyType` remain available, but cycle safety is the hard requirement for this phase

This keeps `CircularDependencyException` aligned with the rest of the domain-exception style in the codebase.

### 4. Derive milestone status from linked task state on task writes

The cleanest implementation is to recompute the affected milestone whenever a task is created, reassigned to a milestone, removed from a milestone, or has its status changed.

Locked milestone rules from context:

- a task is complete only when `status = DONE`
- a milestone is `COMPLETED` only when every linked task is `DONE`
- otherwise the milestone remains non-complete

This should stay inside the project-management module rather than hiding milestone updates inside generic Prisma hooks.

### 5. Make utilization planning-oriented and query-window based

The most concrete interpretation of the locked decision is:

- `allocatedHours` = sum of `estimatedHours` for open tasks assigned to an employee inside the selected window
- `availableHours` = weekday capacity in the selected window minus approved leave time, only for employees whose lifecycle state makes them available in that window

The repo does not yet model labor rates or richer workforce calendars, so the planner should use a simple, explicit capacity rule such as `8 hours * business days in range`.

### 6. Fire budget-overrun alerts synchronously on threshold crossing

Phase 10 does not need a scheduler or notification engine of its own. The cleanest behavior is:

- compare previous and next `actualCost` on project create/update
- if the project crosses from below threshold to at-or-above threshold, create:
  - one durable `OutboxEvent`
  - in-app `Notification` rows for tenant admins and for the project manager if that employee has a linked user
- if the project stays above threshold on later edits, do not re-emit alerts

This satisfies the phase goal without pre-building Phase 11.

### 7. Update shared test helpers before feature implementation fans out

Phase 10 should start with a project-management harness because:

- dependency validation needs graph-shaped fixtures
- utilization needs HR and task-estimate fixtures
- budget alerts need notification/outbox assertions
- BI regression tests must keep working after the manager relation changes

The easiest route is a dedicated `project-management-test-store.mjs` plus targeted updates to the BI harness where it assumes a user-backed project manager.

## Domain Rules The Planner Should Treat As Locked

### Ownership and access

- project managers are `Employee` records
- mutating project-management endpoints should be restricted to `project_manager` and `tenant_admin`
- read endpoints should remain available to `viewer` as well as role owners, consistent with other backend modules

### Task and milestone behavior

- dependencies are allowed only within the same project
- milestones derive completion from linked tasks
- `DONE` is the only task status that counts as complete for milestone completion

### Cost and alerts

- `actualCost` stays manual in Phase 10
- the overrun threshold is `>= 10%`
- alerts go to the manager and tenant admins
- the alert is durable and fires once per threshold crossing

### Utilization semantics

- the metric is planning-oriented, not attendance-based
- availability depends on employee lifecycle plus approved leave
- open-task estimates drive allocation

## Risks And Planning Traps

### 1. Manager relation drift

If the schema changes `Project.managerId` to an employee relation but helpers, BI tests, or DTOs keep treating it as a user id, the phase will break unrelated tests and cause hidden data-contract drift.

### 2. Milestone linkage under-specification

If planning leaves milestone linkage vague, execution may drift into a join table or manual milestone status, both of which would contradict the locked phase decisions.

### 3. False-positive dependency validation

If cycle detection only checks direct reciprocal edges instead of the full graph, the success criterion can appear to pass while longer cycles still slip through.

### 4. Utilization overreach

If Phase 10 tries to derive labor cost, attendance utilization, or advanced scheduling calendars, it will expand beyond the locked scope and entangle work better suited for later phases.

### 5. Notification-phase leakage

If budget alerts are designed as a full delivery pipeline instead of durable local notification/outbox writes, Phase 10 will accidentally pull Phase 11 into scope.

### 6. Audit blind spots

If the project-management routes are not added to the global audit lookup map, the module will technically mutate data under `AuditInterceptor` but lose useful before-state coverage.

## Validation Architecture

Phase 10 should validate across four layers:

- schema/client sync after the relation and linkage changes
- unit tests for DAG validation, milestone recomputation, utilization math, and budget-threshold crossing
- integration tests for project/task/milestone CRUD, role gates, tenant scoping, and notification/outbox side effects
- targeted regression coverage proving BI still reads shared `Project` records correctly after the manager relation change

Recommended execution commands during the phase:

- `pnpm --filter @amdox/db db:push`
- `pnpm --filter @amdox/db generate`
- `pnpm --filter @amdox/types build`
- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/api run test:unit:raw`
- `pnpm --filter @amdox/api run test:integration:raw`

Wave 0 should include:

- a reusable project-management test harness
- project-domain exception/contracts coverage
- CRUD and dependency baseline tests
- a BI regression fixture update where project manager ownership changes

## Planning Implication

The cleanest plan split for Phase 10 is:

1. schema evolution, shared project contracts, harness updates, and blocking Prisma/client sync
2. project-management module plus project/task/milestone CRUD and audit integration
3. dependency validation, milestone recomputation, and utilization reporting
4. budget-overrun alerting, durable notification/outbox behavior, and end-to-end/regression verification

That ordering stabilizes the data model first, then the CRUD surface, then the derived behavior, and finally the alerting/verification layer.
