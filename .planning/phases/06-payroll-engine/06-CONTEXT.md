# Phase 6: Payroll Engine - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend payroll-processing slice for gross-to-net payroll in the existing ERP foundation: configure and apply India payroll rules, run payroll as a BullMQ-backed saga, generate payslip PDFs, persist payroll results, post payroll accounting into the existing ledger, and recover safely when a payroll run fails.

This phase delivers payroll domain rules, run orchestration, payslip artifacts, and accounting integration. It does not add payroll frontend UX, bulk employee email delivery, or the broader notification platform beyond the admin alerts needed for payroll-run outcomes.

</domain>

<decisions>
## Implementation Decisions

### Pay Input Model

- **D-01:** Payroll must use a persistent per-employee salary structure rather than ad hoc run-time gross-pay input.
- **D-02:** The monthly payroll calculation should include attendance-derived overtime from Phase 5 in the same payroll run.
- **D-03:** Attendance and approved leave data should influence payroll outcomes through payable-days and loss-of-pay handling rather than bypassing the employee salary structure.

### India Tax Policy

- **D-04:** Phase 6 must support both India old and new tax regimes.
- **D-05:** Tax regime selection is employee-specific rather than tenant-wide, so the payroll engine must calculate according to the regime assigned to each employee/profile.
- **D-06:** India payroll rules in this phase include the roadmap-required slabs plus rebate under section 87A, PF at 12%, and professional tax.

### Payroll Run Scope

- **D-07:** A payroll run is scoped to one legal entity and one pay period.
- **D-08:** Failed payroll runs may be retried after compensation and cleanup complete.
- **D-09:** Completed payroll runs are immutable in place; any post-completion correction must happen through a reversal and adjustment flow rather than rerunning the same completed record.

### Accounting and Payroll Outputs

- **D-10:** Payroll accounting should post one summarized GL result per payroll run rather than one journal entry per employee.
- **D-11:** Payslips are generated individually per employee, stored in S3, and linked back to the payroll run data.
- **D-12:** Payroll success and failure outcomes must emit admin-facing events or alerts in Phase 6 so operators can react without waiting for Phase 11.
- **D-13:** Compensation on failure must prioritize financial integrity: reverse any partial payroll GL posting, mark the run `FAILED`, and preserve enough run state for operators to inspect and retry.

### the agent's Discretion

- Exact salary-component schema design for earnings and deductions, as long as it supports persistent employee payroll structure and the locked India rules above
- Exact batch/chunk mechanics inside the BullMQ saga, as long as processing remains aligned with the requirement of batches of 100 and the 10,000-employee performance target
- Exact payslip PDF template/layout and S3 object-key naming
- Exact admin alert transport in Phase 6, as long as payroll outcomes are persisted/emitted in a way Phase 11 can build on later

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 6 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` - `PAY-01` through `PAY-06`, plus related constraints from `FIN-02`, `FIN-03`, `FIN-06`, `SEC-07`, `SEC-08`, and `OBS-04`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable quality constraints
- `.planning/STATE.md` - current execution state and prior-phase carry-forward notes

### Prior phase context that constrains payroll

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - tenant scoping, audit expectations, hybrid enum strategy, and request-context rules
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - BullMQ + S3 workflow patterns, durable event persistence, and finance-side review/alert handling
- `.planning/phases/05-hr-core/05-CONTEXT.md` - employee lifecycle, attendance/overtime rules, leave semantics, and HR background-job conventions

### Existing payroll-adjacent data model and shared types

- `packages/db/prisma/schema.prisma` - existing `PayrollRun`, `Payslip`, `TaxSlab`, `Employee`, `Attendance`, `LeaveRequest`, `JournalEntry`, `JournalLine`, `Notification`, and `OutboxEvent` models
- `packages/db/src/index.ts` - exported Prisma model surface available to `apps/api`
- `packages/types/src/enums.ts` - shared `PayrollRunStatus`, `EmployeeStatus`, and other evolving workflow enums

### Existing backend patterns and integration points

- `apps/api/src/app.module.ts` - current module registration and global guard/interceptor setup
- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit `forTenant()` usage for background jobs
- `apps/api/src/finance/finance.service.ts` - existing journal posting and reversal rules that payroll GL integration should reuse
- `apps/api/src/hr/hr.service.ts` - attendance, overtime, leave, and employee-state rules payroll must consume rather than duplicate
- `apps/api/src/hr/hr.module.ts` - current vertical-slice backend module pattern
- `apps/api/src/hr/queue/hr-operations.queue.ts` - repeatable per-tenant BullMQ registration pattern
- `apps/api/src/hr/queue/hr-operations.processor.ts` - background job processor pattern using `prisma.forTenant()`
- `apps/api/src/ap-ar/ap-ar.module.ts` - BullMQ root/queue registration and module wiring pattern
- `apps/api/src/ap-ar/queue/invoice-ocr.queue.ts` - queue job naming and payload pattern
- `apps/api/src/ap-ar/queue/invoice-ocr.processor.ts` - worker pattern for fallback providers and workflow follow-through
- `apps/api/src/ap-ar/storage/invoice-storage.service.ts` - S3 storage pattern for document upload and retrieval

### Codebase guidance

- `.planning/codebase/ARCHITECTURE.md` - NestJS request flow, Prisma boundaries, and ledger architecture notes
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, and money representation conventions
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma`: payroll persistence already has baseline models for `PayrollRun`, `Payslip`, and `TaxSlab`, so Phase 6 should extend behavior on top of this existing schema foundation rather than invent a separate storage path.
- `apps/api/src/prisma/prisma.service.ts`: background payroll processing can follow the established `forTenant()` pattern for explicit tenant-safe jobs outside request CLS.
- `apps/api/src/hr/hr.service.ts`: attendance hours, overtime derivation, leave lifecycle, and employee lifecycle rules already exist and should be treated as payroll inputs rather than reimplemented.
- `apps/api/src/finance/finance.service.ts`: journal creation, posting, reversal, period-open checks, and minor-unit money handling should remain the source of truth for payroll GL behavior.
- `apps/api/src/ap-ar/storage/invoice-storage.service.ts`: existing S3 upload/download service pattern can be mirrored for payslip PDF storage.
- `apps/api/src/hr/queue/hr-operations.*` and `apps/api/src/ap-ar/queue/invoice-ocr.*`: existing queue registration, repeat-job setup, worker-host processing, and failure-handling patterns are directly reusable for payroll saga orchestration.

### Established Patterns

- Backend capabilities are implemented as vertical NestJS modules with thin controllers and service-layer business rules.
- Long-running and background workflows use BullMQ with explicit per-tenant payloads instead of relying on CLS request state.
- Financial amounts are stored and processed in minor units, and accounting integrity is enforced through the finance service rather than duplicated in module-local logic.
- Durable operational follow-through uses `OutboxEvent` and `Notification` persistence even before the dedicated notification phase.
- S3-backed artifact storage already exists in the API layer and should stay consistent for payroll documents.

### Integration Points

- Phase 6 should land as a new backend module under `apps/api/src/payroll`.
- Payroll jobs should connect employee, attendance, leave, and tax data into the new payroll engine while posting summarized accounting into the existing finance path.
- Payslip generation should reuse the established S3 integration pattern and persist document location on the `Payslip` record.
- Failure handling should bridge into the existing `OutboxEvent` and `Notification` tables so Phase 11 can later expand the delivery layer without changing payroll-domain behavior.

</code_context>

<specifics>
## Specific Ideas

- Keep payroll data model centered on persistent employee compensation structure, not one-off input payloads per run.
- Treat payroll as a legal-entity accounting event with one summarized posting per run, while keeping employee-level detail in payslips and payroll result records.
- Reuse Phase 5 attendance/overtime outputs as payroll inputs instead of redefining overtime logic inside payroll.
- Preserve operator visibility on failed payroll runs rather than silently rolling everything away.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 06-payroll-engine_
_Context gathered: 2026-04-18_
