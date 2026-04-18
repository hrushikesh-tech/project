# Phase 5: HR Core - Technical Research

**Objective:** Define a concrete backend architecture for employee management, org chart queries, department hierarchy, leave workflow/state transitions, leave accrual, and attendance tracking on top of the existing Phase 2 schema and current NestJS backend patterns.

## 1. Starting Point in the Codebase

- `packages/db/prisma/schema.prisma` already contains `Employee`, `Department`, `LeaveType`, `LeaveRequest`, `LeaveBalance`, and `Attendance`, so Phase 5 should build behavior on top of real models rather than inventing a second HR data layer.
- `apps/api/src/prisma/prisma.service.ts` establishes the crucial split between request-scoped `tenant` access and explicit `forTenant()` access for background jobs. HR background work must follow this pattern because leave accrual, pending auto-cancel, and future-dated lifecycle transitions run outside request CLS.
- `apps/api/src/common/interceptors/audit.interceptor.ts` already audits mutations and includes an `employees` lookup path. HR should reuse the existing audit mechanism rather than introducing a separate trail for corrections and lifecycle updates.
- `apps/api/src/finance` and `apps/api/src/ap-ar` demonstrate the current vertical-module NestJS style: thin controllers, service-layer domain rules, shared DTO validation, and module-local orchestration. HR should follow the same shape under `apps/api/src/hr`.
- `apps/api/test/helpers/finance-test-store.mjs` and `apps/api/test/helpers/apar-test-store.mjs` establish the project’s current testing pattern: Node test runner, Nest integration tests against built `dist`, and an in-memory Prisma-like harness for domain coverage. Phase 5 should extend this style with HR fixtures instead of introducing a different framework.

## 2. Recommended Phase Shape

Create a dedicated `apps/api/src/hr/` vertical module with these responsibilities:

- `HrModule` for HR-specific controller, queue, and service wiring
- `HrController` for employee, department, org-chart, leave, and attendance routes
- `HrService` for request-path orchestration and lifecycle rules
- `OrgChartQueryService` (or equivalent subservice) for recursive hierarchy reads
- `LeaveWorkflowService` for leave transitions, approval routing, cancellation, and balance mutation rules
- `HrJobsService` or queue processors for nightly accrual, pending auto-cancel, and effective-date employee transitions
- `AttendanceService` for daily attendance capture, corrections, and derived hour/overtime calculation

This keeps Phase 5 cohesive as a backend-only HR slice while still reusing shared project services for Prisma, auth/tenant context, and audit logging.

## 3. Data Model and Shared-Contract Changes Needed Before Execution

The base HR models exist, but several fields and contracts should be strengthened so the module can implement the locked Phase 5 behavior cleanly.

### 3.1 Employee lifecycle and department-head linkage

The current schema supports employee hierarchy via `managerId`, but department ownership is incomplete for the locked decisions:

- `Department.headId` exists as a scalar but does not define a relation to `Employee`
- employee lifecycle behavior depends on dates as well as status, so roster-active queries should consider:
  - `hireDate <= now`
  - `terminationDate is null or > now`
  - `deletedAt is null`

Recommended adjustments:

- add an explicit optional relation from `Department.headId` to `Employee`
- preserve `Employee.status` for core lifecycle only, not transient leave state
- keep future-dated termination behavior in service/job logic rather than overloading the schema with more status fields

### 3.2 Leave-request operational fields

The current `LeaveRequest` model is too thin for the locked workflow:

- it has `approvedBy`, but no approval/rejection timestamps
- it has no explicit cancellation metadata
- it has no durable system reason field for auto-cancel cases

Recommended additions:

- `approvedAt DateTime?`
- `rejectedAt DateTime?`
- `cancelledAt DateTime?`
- `cancelReason String?`
- `systemReason String?`
- optional `decisionByEmployeeId String?` if the project wants employee-linked approver references instead of raw user ids

These changes make DRAFT -> PENDING -> APPROVED / REJECTED -> CANCELLED observable and auditable.

### 3.3 Leave-balance durability

`LeaveBalance` already stores `balance` and `year`, which is enough for the roadmap requirement. The key implementation decision is not a schema rewrite; it is ensuring the service and job logic:

- caps nightly accrual at `LeaveType.maxBalance`
- enforces `carryForwardLimit` separately at year boundaries
- deducts balance on approval, not on submission
- restores balance only for approved cancellations that occur at least 48 hours before start

That means the phase mainly needs service contracts and test coverage rather than a second balance ledger model.

### 3.4 Attendance correction metadata

The current `Attendance` model can store clock-in/out, hours, overtime, and status, but correction behavior would be more robust with:

- `correctedBy String?`
- `correctedAt DateTime?`
- `correctionReason String?`

If those fields are not added, audit logging still provides a fallback trail, but explicit correction metadata will make HR review flows and integration tests clearer.

## 4. Org Chart and Department Tree Query Strategy

### 4.1 Recursive CTE is the right contract

The roadmap success criteria explicitly require a recursive CTE org-chart query. Prisma does not offer first-class recursive hierarchy queries, so the best fit is:

- use `prisma.$queryRaw` / `prisma.raw` with parameterized SQL for recursive reads
- keep writes in the standard tenant-scoped Prisma delegates
- wrap raw SQL access in a dedicated query service instead of scattering query text through controllers

### 4.2 Tenant-safe recursive reads

Recursive CTEs must include tenant filters at both the anchor and recursive steps. Recommended patterns:

- employee org chart:
  - anchor on a requested manager/root employee or top-level employees where `managerId is null`
  - recursive step joins `Employee` reports on `managerId`
  - every step filters `tenantId = $tenantId` and `deletedAt is null`
- department tree:
  - anchor on departments where `parentId is null`
  - recursive step joins children on `parentId`
  - every step filters `tenantId = $tenantId` and `deletedAt is null`

Return shape should include:

- `id`
- `parentId` / `managerId`
- `depth`
- employee or department display fields needed by the route contract

### 4.3 Separate read contracts are important

The discussion locked two distinct read surfaces:

- employee reporting hierarchy
- department tree

Do not merge them into one combined endpoint. Keeping them separate will simplify query logic, route naming, and downstream BI/payroll reuse.

## 5. Employee and Department Service Design

### 5.1 Employee lifecycle rules

Service logic should enforce the locked decisions exactly:

- employee records may be created before `hireDate`
- active-roster queries include only employees whose `hireDate` is effective
- future-dated terminations set `terminationDate` immediately but do not remove the employee from active queries until the date is effective
- once the employee is terminated, only limited non-critical updates remain allowed

This suggests splitting employee operations into:

- create/update profile
- lifecycle actions (activate, schedule termination, finalize termination through jobs)
- read/list with roster-aware filtering

### 5.2 Department-head validation

When assigning `headId`, validate:

- the referenced employee exists in the same tenant
- the employee belongs to the same department

Cross-department managers are allowed, but cross-department department heads are not.

### 5.3 Roles and access

Use the existing auth stack:

- manager and HR access should map to authenticated users with role checks via `@Roles()`
- employee/department/leave/attendance resource lookups must always remain tenant-scoped per `SEC-07`
- integration coverage should prove cross-tenant requests receive `403`

## 6. Leave Workflow and Notification Bridge

### 6.1 State machine behavior

The leave workflow should be enforced in service logic with explicit transition methods rather than open-ended `PATCH` updates. Recommended actions:

- create draft request
- submit draft to pending
- approve pending request
- reject pending request
- cancel approved request
- auto-cancel pending request (system action)

Each action should validate:

- current state
- date constraints
- available balance when moving to `APPROVED`
- 48-hour cutoff when moving from `APPROVED` to `CANCELLED`

### 6.2 Approval routing

The locked Phase 5 contract is manager-first with HR fallback/override. Practically, the service should:

- determine the employee’s manager from `Employee.managerId`
- allow direct manager approval in the normal flow
- allow `hr_manager` role to approve or reject even when they are not the manager

### 6.3 Notification behavior

Roadmap success criteria include `PENDING -> REJECTED (notifies)`. The full notification engine is Phase 11, but Phase 4 already established the bridge strategy:

- write durable `OutboxEvent` rows now
- optionally create lightweight in-app `Notification` rows for immediate visibility

Phase 5 should reuse that bridge rather than deferring rejection/system-cancel observability to a future phase.

## 7. Background Job Design

### 7.1 Use BullMQ, not ad hoc timers

The repo already uses `@nestjs/bullmq` in AP/AR, and the requirements explicitly call for a BullMQ cron for leave accrual. Recommended HR queues:

- `hr-leave-accrual`
- `hr-leave-auto-cancel`
- `hr-employee-lifecycle`

Even if some jobs are registered on the same queue, keep their job names distinct and typed.

### 7.2 Nightly accrual

Nightly accrual should:

- iterate tenant by tenant or by explicit tenant payload
- load active employees and relevant leave types
- create or update `LeaveBalance` for the current year
- add `LeaveType.accrualRate`
- cap at `LeaveType.maxBalance`
- avoid duplicate daily accrual for the same employee/leave-type/date window

### 7.3 Pending auto-cancel

The auto-cancel job should:

- find `LeaveRequest` rows with `status = PENDING` and `startDate < now`
- set them to `CANCELLED`
- write a system reason
- optionally emit outbox/notification records for visibility

### 7.4 Effective-date employee transitions

Because Phase 5 locks future-dated terminations, a job should also:

- find employees whose `terminationDate <= now` and are still effectively active
- mark them terminated if status has not already been finalized
- ensure roster reads stop returning them afterward

This is not explicitly named in the roadmap, but it is required to satisfy the user’s locked lifecycle decision.

## 8. Attendance Capture and Correction Pattern

### 8.1 One daily record is the correct starting scope

The current schema already enforces `@@unique([tenantId, employeeId, date])`, which matches the locked decision of one attendance record per employee per day. That means Phase 5 should not introduce multi-punch support yet.

### 8.2 Derived hours and overtime

Recommended attendance flow:

- clock-in creates or updates the day record
- clock-out completes the record
- service calculates:
  - `hoursWorked`
  - `overtimeHours` when beyond a configured daily threshold

Keep the threshold explicit in configuration or service constants and document it in the plan.

### 8.3 Missing clock-out behavior

The user explicitly rejected guessed times. Therefore:

- incomplete records remain incomplete
- correction endpoints/actions allow managers and HR to update them later
- corrections should remain auditable via existing audit logs and, ideally, explicit correction metadata

## 9. Testing and Verification Strategy

### 9.1 Existing infrastructure is sufficient for Phase 5

The current project already has:

- build command: `pnpm --filter @amdox/api build`
- unit test command: `pnpm --filter @amdox/api test:unit:raw`
- integration test command: `pnpm --filter @amdox/api test:integration:raw`

That means Phase 5 does not require a Wave 0 test-framework install. It does require:

- a dedicated HR harness, likely `apps/api/test/helpers/hr-test-store.mjs`
- unit coverage for lifecycle, leave transitions, accrual calculations, auto-cancel, and overtime derivation
- integration coverage for employee/department/org-chart/leave/attendance routes

### 9.2 Critical behaviors that should be test-covered

- creating pre-start employees without listing them as active before `hireDate`
- recursive org-chart depth correctness
- department tree parent-child correctness
- department-head same-department validation
- leave transition legality
- leave-balance deduction on approval
- leave-balance restoration only when cancelled >= 48h before start
- pending auto-cancel behavior
- attendance overtime calculation
- incomplete attendance correction path
- tenant isolation for all routes and raw recursive reads

## Validation Architecture

Use the existing API build + Node test flow:

1. **Schema / shared-contract verification**
   - `pnpm --filter @amdox/db generate`
   - `pnpm --filter @amdox/db db:push`
   - `pnpm --filter @amdox/api build`
2. **Unit verification**
   - lifecycle rules
   - org-chart recursion helpers
   - leave transition and accrual logic
   - attendance overtime and correction logic
3. **Integration verification**
   - employee and department CRUD
   - org-chart and department-tree reads
   - leave submit/approve/reject/cancel flows
   - attendance clock-in / clock-out / correction flows
   - cross-tenant denial paths

## 10. Risks to Call Out in the Plans

- Recursive CTEs can bypass normal tenant extension behavior if tenant filtering is omitted in the raw SQL.
- Leave approval and cancellation can corrupt balances if transitions are not made idempotent and transactionally consistent.
- Background jobs can double-accrue or double-cancel if they do not record or guard against reprocessing.
- Employee-status semantics can drift if leave state is allowed to mutate `Employee.status` against the locked context.
- Attendance correction can weaken auditability if the phase relies only on raw updates and does not preserve explicit correction context.
- Department-head linkage can become inconsistent if `headId` is not validated against the assigned department.
