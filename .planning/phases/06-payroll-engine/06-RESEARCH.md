# Phase 6: Payroll Engine - Research

**Date:** 2026-04-18
**Phase:** 06-payroll-engine
**Status:** Complete

## What This Phase Needs To Solve

Phase 6 has to turn the existing HR and finance foundation into a backend payroll engine that:

- calculates gross-to-net pay using India-specific rules
- consumes persistent employee compensation data plus attendance/leave inputs
- runs in BullMQ as a failure-aware saga
- generates and stores payslips in S3
- posts summarized payroll accounting into the existing GL path
- compensates safely when any downstream step fails

This codebase already has the right building blocks for queue processing, S3 storage, finance posting, and tenant-safe background jobs. What is missing is the payroll domain model above the baseline Prisma schema and a clean orchestration layer under `apps/api/src/payroll`.

## Codebase Findings

### Existing payroll-adjacent assets

- `packages/db/prisma/schema.prisma` already defines `PayrollRun`, `Payslip`, and `TaxSlab`, but those models are only a minimal storage shell today.
- `apps/api/src/prisma/prisma.service.ts` already supports `forTenant(tenantId)` for background jobs. This is the correct pattern for payroll workers because request CLS does not exist in BullMQ processors.
- `apps/api/src/hr/hr.service.ts` already computes overtime and enforces attendance/leave rules. Payroll should consume these outputs rather than re-derive them with different logic.
- `apps/api/src/finance/finance.service.ts` already owns minor-unit money handling, journal posting, reversal, and period-open checks. Payroll should reuse this path for GL integrity.
- `apps/api/src/hr/queue/hr-operations.queue.ts` and `apps/api/src/hr/queue/hr-operations.processor.ts` show the current repeatable-job and per-tenant processor pattern.
- `apps/api/src/ap-ar/ap-ar.module.ts`, `apps/api/src/ap-ar/queue/invoice-ocr.processor.ts`, and `apps/api/src/ap-ar/storage/invoice-storage.service.ts` provide the reference pattern for BullMQ queue wiring, staged workflow handling, provider fallback, and S3 document storage.

### Important gaps

- No payroll NestJS module exists yet.
- No persistent employee salary-structure model exists yet; only run-level payroll and payslip shells exist.
- No PDF generator dependency exists yet for payslips. `@amdox/api/package.json` includes OCR/image/pdf parsing libraries, but not Puppeteer even though `PAY-04` requires it.
- `PayrollRun` currently stores only aggregate totals and counts; it does not yet model run scope such as legal entity, pay-period dates, retry lineage, failure reason, or compensation state.
- `Payslip` stores `deductions` and `taxBreakdown` as JSON, which is useful for flexibility, but it currently has no explicit earnings-component payload or immutable snapshot metadata.

## Recommended Technical Direction

### 1. Add a dedicated payroll vertical slice

Create `apps/api/src/payroll` following the same vertical module pattern used by finance, AP/AR, and HR.

Recommended sub-areas:

- `payroll.module.ts`
- `payroll.controller.ts`
- `payroll.service.ts` for orchestration and query surface
- `engine/` for gross-to-net calculations and India tax logic
- `queue/` for BullMQ saga registration and workers
- `storage/` for payslip S3 persistence
- `pdf/` for payslip rendering/generation
- `posting/` for summarized GL integration
- `dto/` for run creation, retry, lookup, and preview contracts

Why this fits the repo:

- Current backend features are vertical modules with thin controllers and heavy service logic.
- Queue workers live beside their owning module, not in a shared background-jobs package.

### 2. Extend the schema around employee compensation, not ad hoc run input

The locked context requires persistent employee salary structure. The current schema does not have this yet, so planning should expect Prisma changes.

Recommended additions:

- `SalaryStructure` or `EmployeeCompensationProfile`
- `SalaryComponent` or component rows linked to the profile
- optional `PayrollRunEmployee` or `PayrollResult` snapshot table for immutable per-employee run results

Recommended fields/behaviors:

- employee-level tax regime selection
- recurring earnings and recurring deductions
- effective dates so future salary revisions do not rewrite payroll history
- optional flags for PF applicability, professional-tax applicability, and overtime eligibility
- immutable snapshotting of earnings/deductions/tax inputs at payroll-run time

Why a snapshot table matters:

- `Payslip` JSON fields alone are enough for artifact output, but they are weak as an operational source of truth for retries, auditing, and GL reconciliation.
- A normalized payroll-result layer gives the saga a stable checkpoint between calculation and GL posting.

### 3. Model payroll run scope explicitly around legal entity + period

The current `PayrollRun` model needs to expand to support the locked decisions and roadmap success criteria.

Recommended additions to `PayrollRun`:

- `legalEntityId`
- pay-period boundaries or normalized period fields
- `failureReason`
- `attemptNumber` or retry lineage metadata
- `glJournalEntryId` or linkage to summarized posting
- status timestamps for calculation / payslip generation / posting / compensation completion

Recommended status model:

- keep `PayrollRunStatus` in `packages/types/src/enums.ts`
- extend the string-backed lifecycle if needed without moving back to Prisma enums
- preserve terminal statuses for `COMPLETED`, `FAILED`, and optionally `REVERSED`

### 4. Use a staged BullMQ saga with durable checkpoints

The roadmap explicitly calls for:

- period lock
- employee fetch
- batch calculation
- payslip generation
- GL posting
- notification/alert behavior

Recommended saga stages:

1. Validate run scope and open period
2. Snapshot eligible employees for the legal entity
3. Process calculation batches of 100 employees
4. Persist per-employee payroll results
5. Generate payslips from persisted results
6. Upload/store payslip PDFs in S3
7. Post one summarized payroll journal entry
8. Mark run complete and emit admin-facing operational events

Recommended compensation boundary:

- If failure happens before GL posting: keep run `FAILED`, preserve calculated results, do not delete evidence
- If failure happens after GL posting: reverse the GL posting through the finance path, mark run `FAILED`, emit failure alert, preserve retryable state

Why this fits the repo:

- AP/AR already uses a queue processor that updates domain state step-by-step and downgrades some failures into reviewable outcomes rather than destructive rollback.
- HR already proves the repo’s background-work pattern is explicit-tenant, not request-context-based.

### 5. Reuse finance posting instead of inventing payroll-ledger logic

The summary GL entry should be built through `FinanceService` semantics, not through direct Prisma writes to journal tables.

Planning implication:

- payroll will likely need a dedicated posting helper that maps summarized payroll totals into journal lines
- that helper should call the finance layer or a newly extracted finance-posting seam, not bypass it

Key reason:

- `finance.service.ts` already enforces balancing, period state, entry creation, posting, reversal, and minor-unit rules
- bypassing it would create a second accounting implementation with drift risk

### 6. Add a dedicated payslip PDF layer and mirror AP/AR storage conventions

Requirement `PAY-04` says payslips are generated via Puppeteer and stored in S3.

Research conclusion:

- planning must include adding Puppeteer to `@amdox/api`
- payslip rendering should be isolated behind a service, not embedded into the queue processor
- S3 upload should mirror the existing AP/AR storage service shape for consistency

Recommended storage path shape:

- `payslips/{tenantId}/{payrollRunId}/{employeeId}.pdf`

Why:

- it groups artifacts by run for ZIP/export workflows later
- it fits the repo’s existing invoice-storage naming style

### 7. Preserve admin-facing events now, not later

The locked decisions require Phase 6 alerts/events now. The codebase already has `OutboxEvent` and `Notification`, and HR/APAR already use them before the full notification phase.

Planning implication:

- payroll success/failure should write durable outbox and/or notification records
- transport fan-out can remain simple in Phase 6 because Phase 11 will formalize delivery

This keeps operations visible without creating a throwaway alert mechanism.

## Domain Rules The Planner Should Treat As Locked

### Payroll inputs

- salary structure is persistent per employee
- overtime comes from Phase 5 attendance logic
- leave and attendance affect payable days and loss-of-pay, not independent ad hoc overrides

### Tax rules

- both old and new India regimes are required
- regime is employee-specific
- section 87A rebate, PF at 12%, and professional tax are in scope

### Run boundaries

- one payroll run per legal entity and pay period
- failed runs are retryable after compensation/cleanup
- completed runs are immutable and require reversal/adjustment, not in-place rerun

### Accounting and artifacts

- one summarized GL result per payroll run
- one payslip PDF per employee stored in S3
- admin-facing success/failure events/alerts are required in this phase

## Risks And Planning Traps

### 1. Schema is underspecified for the locked salary-structure decision

If planning assumes current schema is sufficient, execution will either:

- collapse salary structure into JSON too early, or
- force run-time-only inputs that violate context

Plan should explicitly include compensation-structure schema work before engine logic.

### 2. Finance service currently exposes request-oriented behavior

`FinanceService` is built around tenant-scoped operations and existing controller/service flows. Payroll background jobs will need either:

- a safe direct way to call finance posting in a job context, or
- a small extracted posting seam reusable outside request handlers

Plan should include this integration seam instead of assuming the queue worker can just call current request-oriented methods unchanged.

### 3. Performance target can fail if PDF generation is on the hot critical path

The 10,000 employee target and “batches of 100” requirement mean the plan should avoid serial payslip rendering after calculation.

Planning guidance:

- calculation batching and payslip generation should be separable stages
- PDF generation likely needs controlled concurrency rather than pure serial execution
- performance verification should explicitly measure payroll with payslip generation enabled

### 4. Failure compensation must be narrower than full rollback

Deleting intermediate results would make support and retries harder. The better fit for this repo is:

- preserve payroll result records
- reverse GL only if it was posted
- keep run state inspectable

### 5. Test harness drift risk is real

`.planning/codebase/TESTING.md` shows tests depend on compiled `dist` output and in-memory harnesses. Payroll will likely need:

- unit tests for calculation engine
- integration tests for API + worker orchestration
- either harness extensions or carefully scoped real-stack smoke verification for the most failure-prone paths

If planning ignores the build-first contract and harness burden, verification will become brittle.

## Recommended Plan Shape

This phase is large enough that planning should probably split it into multiple plans, not one giant PLAN file.

Recommended decomposition:

### Plan A: Payroll schema and domain foundations

- add compensation and payroll-result data structures
- extend `PayrollRun` / `Payslip` as needed
- add shared enums/types/exceptions

### Plan B: Payroll engine and tax computation

- implement gross-to-net calculation service
- implement India regime logic, PF, professional tax, rebate handling
- add deterministic unit coverage for 5 required salary scenarios

### Plan C: Saga orchestration, payslips, and GL integration

- create queue wiring and worker stages
- generate/store payslips
- post summarized GL entries
- implement compensation/reversal path and admin alerts

### Plan D: Verification and performance hardening

- integration tests for happy/failure paths
- batch-size and throughput validation
- artifact/assertion coverage around S3 and notification persistence

This order fits the repo because later plans depend on schema and engine semantics being stable before orchestration and verification.

## Testing And Verification Guidance

### Minimum automated coverage

- calculation tests for both tax regimes and the 5 roadmap salary scenarios
- payroll-run failure test proving GL reversal and `FAILED` status
- integration coverage for legal-entity scoped run creation and retrieval
- queue-worker tests for batch behavior and retry-safe status transitions
- payslip storage contract test (mock S3 client is acceptable at unit level)

### Performance verification

- do not rely only on unit tests for the 10,000 employee target
- plan should include either a dedicated performance script or a focused load-style harness for payroll batching
- measure end-to-end run time with calculation, result persistence, and payslip generation assumptions clearly stated

### Build/test contract

`apps/api/package.json` requires a build before tests because tests import built `dist` artifacts. Payroll plans should preserve this convention rather than assuming source-direct execution.

## Validation Architecture

The plan should be validated across four dimensions:

1. **Requirements coverage**: every `PAY-01` to `PAY-06` requirement is claimed by at least one plan
2. **Decision fidelity**: all locked context decisions appear in plan objectives or task details, especially legal-entity scoping, employee-specific tax regime, summarized GL posting, and retry-after-compensation behavior
3. **Cross-module integration**: plans explicitly connect HR inputs, finance posting, S3 storage, and outbox/notification persistence instead of treating payroll as an isolated service
4. **Operational integrity**: plans include failure compensation, immutable payroll history, deterministic tests, and performance verification for the 10,000 employee target

Recommended blocking checks for the later plan checker:

- block if plans do not create/extend persistent compensation structure
- block if plans bypass the finance posting path with direct journal writes
- block if payslip generation/storage is omitted or left as a placeholder
- block if no task covers failure compensation and admin alert persistence
- block if no task covers the 5 tax scenarios and the batch/performance requirement

## Bottom Line

Phase 6 is feasible with the current architecture, but only if planning treats it as an integration-heavy backend phase rather than “just a tax calculator.”

The strongest implementation path in this repo is:

- add missing payroll domain structures first
- build a deterministic calculation engine second
- wire BullMQ saga + payslip + GL integration third
- finish with targeted failure/performance verification

That sequence lines up with the codebase’s current module patterns and reduces the risk of rework during execution.

## RESEARCH COMPLETE
