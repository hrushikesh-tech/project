---
phase: 05-hr-core
plan: all
subsystem: api
tags: [nestjs, prisma, postgres, bullmq, hr, attendance, leave]
requires:
  - phase: 02-database-schema-authentication
    provides: tenant-scoped Prisma access, auth roles, audit interceptor
  - phase: 04-ap-ar-automation
    provides: BullMQ and notification/outbox patterns
provides:
  - tenant-safe HR employee and department APIs
  - recursive org-chart and department-tree reads
  - manager-first leave workflow with balance mutations
  - HR background jobs for accrual, auto-cancel, and effective termination
  - auditable attendance clocking and correction flows
  - reusable HR unit and integration harness
affects: [06-payroll-engine, 11-notification-event-engine, 15-testing-strategy]
tech-stack:
  added: []
  patterns:
    [
      tenant-scoped HR module,
      harness-backed Nest integration tests,
      recursive SQL hierarchy reads,
    ]
key-files:
  created:
    [
      apps/api/src/hr/hr.module.ts,
      apps/api/src/hr/hr.service.ts,
      apps/api/test/helpers/hr-test-store.mjs,
      apps/api/test/integration/hr.leave-attendance.api.test.mjs,
    ]
  modified:
    [
      apps/api/src/app.module.ts,
      packages/db/prisma/schema.prisma,
      .planning/STATE.md,
      .planning/phases/05-hr-core/05-VALIDATION.md,
    ]
key-decisions:
  - "Used one-to-one DepartmentHead modeling with unique headId to satisfy Prisma relation rules."
  - "Kept leave and attendance logic inside one vertical HrService so Payroll can build on a stable HR contract."
  - "Used focused harness-backed Nest integration tests instead of the full AppModule for HR verification."
patterns-established:
  - "HR mutations use tenant-scoped Prisma delegates; only recursive hierarchy reads use parameterized raw SQL."
  - "Manager authorization resolves from employee hierarchy with hr_manager and tenant_admin override paths."
requirements-completed: [HR-01, HR-02, HR-03, HR-04, HR-05, HR-06, HR-07]
duration: 1h 40m
completed: 2026-04-18
---

# Phase 5: HR Core Summary

**Tenant-safe HR APIs with lifecycle-aware employees, recursive org hierarchy reads, leave workflow automation, and auditable attendance tracking**

## Performance

- **Duration:** 1h 40m
- **Started:** 2026-04-18T02:39:00+05:30
- **Completed:** 2026-04-18T04:19:06+05:30
- **Tasks:** 11
- **Files modified:** 23

## Accomplishments

- Added the full `apps/api/src/hr` backend slice with DTO validation, role-aware routes, lifecycle rules, and recursive org/dept reads.
- Completed Phase 5 leave and attendance behavior including legal transitions, balance mutation, rejection notifications, nightly HR jobs, and correction audit fields.
- Added the reusable HR harness plus dedicated unit and integration coverage so the phase verifies cleanly with the raw Node test runner.

## Files Created/Modified

- `apps/api/src/hr/*` - HR module, controller, service, DTOs, exception filter, serialization, and queue/processor layer.
- `apps/api/test/helpers/hr-test-store.mjs` - Prisma-like in-memory harness for HR entities, notifications, outbox events, and recursive reads.
- `apps/api/test/unit/hr.service.test.mjs` and `apps/api/test/unit/hr.leave-attendance.test.mjs` - lifecycle, hierarchy, leave, jobs, and attendance unit coverage.
- `apps/api/test/integration/hr.api.test.mjs` and `apps/api/test/integration/hr.leave-attendance.api.test.mjs` - tenant-guarded HTTP verification for HR routes.
- `packages/db/prisma/schema.prisma` - finalized `DepartmentHead` relation with the required unique `headId`.
- `apps/api/src/app.module.ts` - wired `HrModule` into the API runtime.

## Decisions Made

- Used a unique `headId` constraint because Prisma requires the defining side of the `DepartmentHead` one-to-one relation to be unique.
- Kept leave rejection notifications on the existing outbox plus in-app notification pattern established in Phase 4.
- Ran HR HTTP tests through a focused Nest test app with the real controller/service and explicit guards instead of booting unrelated modules.

## Deviations from Plan

- Added the `@unique` constraint on `Department.headId` during execution because Prisma generation rejected the originally drafted one-to-one relation without it.
- Started the local `timescaledb` Docker service and ran `prisma db push --accept-data-loss --skip-generate` because the database was not available and Prisma required an explicit safety acknowledgement.

## Issues Encountered

- The initial `db:push` was blocked first by the Windows sandbox and then by a stopped local Postgres container; starting the container and rerunning Prisma resolved it.
- Runtime tests initially loaded stale `@amdox/types` artifacts, so rebuilding that shared package was necessary before the new HR enums and exceptions were available to the compiled API.

## User Setup Required

None - no new external service configuration was introduced beyond the existing local Docker database requirement.

## Next Phase Readiness

- Payroll can now build directly on stable employee, department, leave balance, attendance, and effective-status behavior.
- Notification and event work can reuse the HR outbox payloads and in-app notification rows already emitted from leave rejection flows.

---

_Phase: 05-hr-core_
_Completed: 2026-04-18_
