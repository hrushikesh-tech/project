# Phase 10: Project Management - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend project-management slice for project CRUD, DAG-validated task dependencies, budget overrun alerting, resource-utilization reporting, and milestone management.

This phase delivers the domain rules, validation behavior, reporting semantics, and alerting hooks needed to manage projects inside the ERP. It does not add frontend Gantt-chart UX, cross-project dependency graphs, labor-rate costing, or the full multi-channel notification platform from Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Project Cost and Budget Tracking

- **D-01:** `Project.actualCost` remains a manual project-level value in Phase 10 rather than being derived from task hours or employee labor rates.
- **D-02:** Budget overrun detection must fire when `actualCost` first reaches or exceeds `budget * 1.10`.
- **D-03:** Budget overrun alerting should notify the assigned project manager and tenant admins.
- **D-04:** The budget overrun alert should fire once on the threshold crossing rather than on every subsequent update while the project remains over budget.
- **D-05:** Phase 10 should persist a durable outbox/notification event for the overrun so Phase 11 can deliver richer channels later.

### Resource Utilization Semantics

- **D-06:** Resource utilization is planning-oriented in Phase 10.
- **D-07:** `allocatedHours` should be calculated from the sum of `estimatedHours` on open tasks assigned to an employee.
- **D-08:** `availableHours` should be based on standard capacity adjusted for approved leave and employee active-status rules from Phase 5.
- **D-09:** Resource-utilization reporting should use HR-backed employee availability rather than attendance-derived actual worked hours.

### Task Dependency Rules

- **D-10:** Task dependencies are allowed only between tasks in the same project.
- **D-11:** Dependency validation must treat the task graph as a DAG and throw `CircularDependencyException` when a new or updated dependency would introduce a cycle.
- **D-12:** Phase 10 should support the existing dependency-type enum surface, but success for this phase is anchored on cycle-safe validation rather than advanced scheduling math.

### Milestone Behavior

- **D-13:** Milestones need explicit task linkage so milestone status can be derived from linked tasks.
- **D-14:** A task counts as complete only when `status = DONE`.
- **D-15:** A milestone becomes `COMPLETED` only when all linked tasks are `DONE`.
- **D-16:** If not all linked tasks are `DONE`, the milestone remains in a non-complete state rather than being auto-marked complete.

### Project Ownership Model

- **D-17:** `Project.managerId` should reference an `Employee`, not a loose user id or external identifier.
- **D-18:** Project-management ownership and utilization logic should therefore align with HR employee lifecycle and leave semantics rather than a separate user-only identity model.

### the agent's Discretion

- Exact endpoint names, DTO shapes, and controller/service split for projects, tasks, dependencies, milestones, and utilization queries
- Exact persistence mechanism for the "alert fired once" state, as long as repeated overrun alerts are suppressed until a meaningful threshold-crossing event occurs again
- Exact standard-capacity constant or configuration surface used for available-hours calculations, as long as it is implemented consistently and documented in the plan
- Exact schema shape for milestone-to-task linkage, as long as milestone completion remains automatically derived from linked task completion
- Exact error-message wording for dependency, ownership, and milestone-validation failures

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 10 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `PM-01` through `PM-05`, plus relevant constraints from `AUTH-02`, `BI-04`, `SEC-07`, and `SEC-08`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable constraints
- `.planning/STATE.md` - current execution state and carry-forward notes from completed phases

### Prior phase context that constrains Project Management

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - tenant scoping, role model, audit expectations, and hybrid status-enum strategy
- `.planning/phases/03-general-ledger-finance-core/03-CONTEXT.md` - money handling and finance-domain expectations that constrain project budget and actual-cost fields
- `.planning/phases/05-hr-core/05-CONTEXT.md` - employee lifecycle, leave semantics, and attendance policy that shape manager ownership and available-hours calculations
- `.planning/phases/09-business-intelligence-dashboard/09-CONTEXT.md` - locked expectation that `project_budget_vs_actual` reads directly from shared `Project` records

### Existing data model and shared types

- `packages/db/prisma/schema.prisma` - existing `Project`, `Task`, `TaskDependency`, and `ProjectMilestone` models
- `packages/db/src/index.ts` - exported Prisma surface available to `apps/api`
- `packages/types/src/enums.ts` - shared `ProjectStatus`, `TaskStatus`, `TaskPriority`, `MilestoneStatus`, `DependencyType`, and `UserRole` enums
- `packages/types/src/bi.ts` - BI metric contract that already includes `project_budget_vs_actual`

### Existing backend patterns and integration seams

- `apps/api/src/app.module.ts` - module registration and global guard/interceptor setup
- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit `forTenant()` background-operation pattern
- `apps/api/src/hr/hr.service.ts` - employee, leave, and availability semantics that utilization logic should reuse
- `apps/api/src/bi/metrics/bi-metrics.service.ts` - current project budget vs actual metric implementation and response expectations
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` - durable outbox/event pattern for threshold-triggered backend automation

### Codebase guidance

- `.planning/codebase/ARCHITECTURE.md` - backend module and request-flow guidance
- `.planning/codebase/CONVENTIONS.md` - validation, tenant scoping, and service-layer business-rule conventions
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

No separate external project-management ADRs or specs exist yet - requirements and constraints are fully captured in the references above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma`: the core project-management tables already exist, so Phase 10 should implement behavior on top of the established persistence layer rather than redesigning storage.
- `packages/types/src/enums.ts`: project, task, milestone, dependency, and role enums already exist and should anchor validation and status transitions.
- `apps/api/src/prisma/prisma.service.ts`: provides the established tenant-safe request pattern plus explicit tenant access for background or system-triggered work.
- `apps/api/src/hr/hr.service.ts`: already encodes employee active-status and approved-leave semantics that can inform available-hours calculations.
- `apps/api/src/bi/metrics/bi-metrics.service.ts`: already reads `Project.budget` and `Project.actualCost` directly, so Phase 10 should preserve that contract.
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts`: shows the current pattern for writing durable outbox events when backend automation crosses a rule threshold.

### Established Patterns

- Backend capabilities land as vertical NestJS modules with thin controllers and service-level business rules.
- Tenant isolation is enforced through JWT -> `TenantGuard` -> CLS -> `PrismaService.tenant`, while non-request work uses explicit tenant-aware Prisma access.
- Evolving workflow states are modeled as TypeScript enums in `packages/types` while Prisma stores string-backed status fields.
- Durable operational signals are persisted through outbox/notification records before the richer delivery engine exists.

### Integration Points

- Phase 10 should land as a new backend module under `apps/api/src/project-management` or an equivalently clear project vertical slice.
- Project-manager ownership should integrate directly with HR employee records rather than introducing a separate identity seam.
- Budget overrun behavior should update shared `Project` data in a way that remains compatible with the existing BI `project_budget_vs_actual` metric.
- Resource-utilization queries need to read task assignments plus HR employee/leave state without violating tenant scoping.
- Milestone-completion logic needs to sit close to task updates so linked milestone status can react when task status reaches `DONE`.

</code_context>

<specifics>
## Specific Ideas

- Keep Phase 10 backend-first and rule-focused; Gantt-chart and rescheduling UX belong to Phase 12.
- Treat utilization as a planning signal, not a retrospective attendance report.
- Keep cost tracking deliberately manual for now because the project does not yet have a labor-rate model that could support trustworthy automatic costing.
- Make overrun alerting durable and future-proof by recording an event now rather than waiting for Phase 11 to exist.

</specifics>

<deferred>
## Deferred Ideas

- Labor-rate-driven automatic actual-cost calculation from task hours
- Cross-project task dependencies
- Multi-milestone task membership via a join table
- Advanced scheduling behavior beyond dependency validation, such as auto-rescheduling or critical-path calculation
- Full notification-channel delivery logic beyond durable event creation

</deferred>

---

_Phase: 10-project-management_
_Context gathered: 2026-04-21_
