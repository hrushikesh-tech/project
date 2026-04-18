# Phase 5: HR Core - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend HR foundation for employee management, department hierarchy, employee org chart queries, leave-management workflow, leave accrual, and attendance tracking.

This phase delivers the domain rules, query contracts, and background-job behavior needed for HR operations. It does not add payroll processing, frontend UX, or broader notification-platform features beyond what Phase 5 needs to complete its own workflow obligations.

</domain>

<decisions>
## Implementation Decisions

### Employee lifecycle

- **D-01:** Employees may exist as pre-start records before `hireDate`, but they do not become part of the active roster until `hireDate`.
- **D-02:** Future-dated terminations are first-class. HR may set `terminationDate` in advance, and the employee remains active until that effective date, after which the system transitions them automatically.
- **D-03:** After termination, only non-critical profile cleanup and notes remain editable. Org placement and lifecycle fields are locked.
- **D-04:** Approved leave does not change core `Employee.status`; leave remains a separate operational state tracked through leave records.

### Org structure

- **D-05:** The primary org chart contract is employee reporting hierarchy.
- **D-06:** Department hierarchy is exposed separately as its own tree rather than being merged into the employee org chart.
- **D-07:** Departments may have one optional head, and that head must be an employee in that same department.
- **D-08:** Employees may report to managers outside their own department.
- **D-09:** Phase 5 should expose separate backend read contracts for employee org chart queries and department tree queries.

### Leave policy

- **D-10:** Leave approval is manager-first by default, with HR acting as fallback and override authority.
- **D-11:** If a leave request remains `PENDING` after its start date passes, the system auto-cancels it immediately and records a system-generated reason.
- **D-12:** Approved leave may be cancelled with automatic balance restoration only when the cancellation happens at least 48 hours before the leave start date.
- **D-13:** If an approved leave cancellation is attempted less than 48 hours before the start date, Phase 5 rejects the cancellation rather than allowing a late cancel with no restoration.
- **D-14:** Nightly accrual adds leave balance up to `LeaveType.maxBalance` and must never exceed that cap.
- **D-15:** `LeaveType.carryForwardLimit` is enforced separately at year-boundary processing rather than during nightly accrual.

### Attendance policy

- **D-16:** Attendance is captured as one record per employee per day with `clockIn`, `clockOut`, derived `hoursWorked`, and attendance `status`.
- **D-17:** Overtime is system-derived from hours worked beyond a standard daily threshold and stored as a calculated value.
- **D-18:** Missing clock-out does not trigger guessed end times; the record remains incomplete until corrected.
- **D-19:** Managers and HR may correct attendance records after the fact, and those corrections must remain auditable.

### the agent's Discretion

- Exact API endpoint names and DTO shapes for employee, department, leave, and attendance resources
- The concrete standard daily threshold used for overtime calculation, as long as it is implemented consistently and documented in the phase plan
- Exact background job names, queue wiring, and scheduling mechanics for accrual and auto-transition jobs
- Exact validation and error-message wording for late cancellation, incomplete attendance, and locked employee records

</decisions>

<specifics>
## Specific Ideas

- Keep employee status focused on core employment lifecycle; do not overload it to mirror leave-state transitions.
- Model the org chart and department hierarchy as separate read models even though both exist in the same HR domain.
- Do not guess missing attendance data such as clock-out times.
- Keep late leave cancellation strict in Phase 5 rather than introducing exception paths or partial restoration rules.

</specifics>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 5 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` - `HR-01` through `HR-07`, plus relevant cross-cutting constraints from `AUTH-09`, `SEC-07`, and `SEC-08`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable constraints
- `.planning/STATE.md` - current execution state and carry-forward constraints from prior phases

### Prior phase decisions that constrain Phase 5

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - tenant-scoping, hybrid enum strategy, audit expectations, and request-context rules
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - established BullMQ/background-work pattern and event/notification persistence expectations

### Existing data model and shared enums

- `packages/db/prisma/schema.prisma` - `Employee`, `Department`, `LeaveType`, `LeaveRequest`, `LeaveBalance`, and `Attendance` models already defined for Phase 5
- `packages/db/src/index.ts` - exported Prisma model surface available to `apps/api`
- `packages/types/src/enums.ts` - shared `LeaveStatus`, `EmployeeStatus`, and `AttendanceStatus` enums used in the application layer

### Existing backend architecture and implementation patterns

- `apps/api/src/app.module.ts` - global module wiring, guards, and interceptor registration that Phase 5 must plug into
- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit background-job tenant access pattern
- `apps/api/src/common/interceptors/audit.interceptor.ts` - mutation audit behavior and existing employee audit mapping
- `apps/api/src/common/schedule/schedule.ts` - current scheduling helper surface
- `apps/api/src/ap-ar/ap-ar.module.ts` - current BullMQ queue registration pattern for a vertical module
- `apps/api/src/ap-ar/queue/invoice-ocr.queue.ts` - existing queue/job naming pattern

### Codebase guidance

- `.planning/codebase/STRUCTURE.md` - current backend module layout, test structure, and Prisma integration pattern
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, and service-layer business-rule conventions
- `.planning/codebase/ARCHITECTURE.md` - request path, guard flow, CLS usage, and raw-vs-tenant Prisma boundaries

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma`: HR persistence models already exist, so Phase 5 should implement behavior on top of the established schema rather than redefining storage.
- `packages/types/src/enums.ts`: leave, employee, and attendance statuses already have shared TypeScript enums suitable for service and DTO validation.
- `apps/api/src/prisma/prisma.service.ts`: provides both request-scoped tenant access and explicit `forTenant()` access for background jobs.
- `apps/api/src/common/interceptors/audit.interceptor.ts`: already audits mutations and includes employee entity lookup support.
- `apps/api/src/ap-ar/ap-ar.module.ts` and `apps/api/src/ap-ar/queue/invoice-ocr.queue.ts`: provide the current reference pattern for queue-backed background processing in a vertical NestJS module.

### Established Patterns

- Backend capabilities are implemented as vertical NestJS modules with thin controllers and service-layer business rules.
- Tenant isolation is enforced through JWT -> `TenantGuard` -> CLS -> `PrismaService.tenant`; non-request jobs must use explicit tenant scoping.
- Shared workflow statuses are modeled as app-layer TypeScript enums, consistent with the Phase 2 hybrid enum strategy.
- Audit logging applies to mutations and should remain in force for HR record changes, especially attendance corrections and lifecycle changes.

### Integration Points

- Phase 5 should land as a new backend module under `apps/api/src/hr` following the same vertical-slice pattern used by finance and AP/AR.
- Org chart and department tree endpoints should fit the `/api/v1/...` controller pattern already established in the API.
- Leave accrual, auto-cancel, and effective-date lifecycle transitions should reuse the existing background-job approach with explicit tenant-aware Prisma access.
- Attendance and leave mutations should integrate with the existing audit path rather than inventing a separate HR-only audit mechanism.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 05-hr-core_
_Context gathered: 2026-04-18_
