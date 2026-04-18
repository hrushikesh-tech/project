# Phase 6: Payroll Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 06-payroll-engine
**Areas discussed:** Pay Input Model, India Tax Policy, Payroll Run Scope, Accounting and Payroll Outputs

---

## Pay Input Model

| Option                                                                               | Description                                                                                                               | Selected |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Fixed monthly salary structure, with attendance/leave only affecting loss-of-pay     | Payroll uses persistent employee salary data and applies attendance/leave adjustments without overtime in the core model. |          |
| Fixed salary structure plus overtime from Phase 5 attendance in the same payroll run | Payroll uses persistent salary structures and also consumes Phase 5 overtime in the run.                                  | yes      |
| Gross pay provided ad hoc per payroll run, without persistent salary structures      | Payroll inputs are supplied fresh for each run instead of being stored per employee.                                      |          |

**User's choice:** Recommended option accepted.
**Notes:** Locked toward persistent employee compensation structure with payroll consuming existing attendance/overtime data.

---

## India Tax Policy

| Option                                                                  | Description                                                       | Selected |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Support both old and new India regimes, selectable per employee/profile | Payroll supports both regimes and chooses per employee.           | yes      |
| New regime only for v1                                                  | Payroll simplifies to only the new regime in v1.                  |          |
| One tenant-wide regime for everyone                                     | Payroll uses a single regime per tenant rather than per employee. |          |

**User's choice:** Recommended option accepted.
**Notes:** Locked toward employee-level tax-regime selection while still covering the roadmap-required India slab/rebate/PF/professional-tax rules.

---

## Payroll Run Scope

| Option                                                                                                               | Description                                                                                 | Selected |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| One run per legal entity and pay period; failed runs can be retried, completed runs require reversal/adjustment flow | Payroll runs remain entity-scoped, retryable after failure, and immutable after completion. | yes      |
| One tenant-wide run per period                                                                                       | Payroll runs span the whole tenant for the period.                                          |          |
| Completed runs can be rerun in place                                                                                 | Payroll allows direct reruns of completed records.                                          |          |

**User's choice:** Recommended option accepted.
**Notes:** Locked toward legal-entity payroll boundaries aligned with finance posting and period control.

---

## Accounting and Payroll Outputs

| Option                                                                                                              | Description                                                                                                    | Selected |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| One summarized GL posting per payroll run, individual payslips in S3, and admin events/alerts on success or failure | Payroll posts summarized accounting, stores employee-level documents, and surfaces run outcomes operationally. | yes      |
| One GL journal entry per employee                                                                                   | Payroll posts employee-by-employee accounting entries.                                                         |          |
| Generate payslips only; defer notifications/events until Phase 11                                                   | Payroll omits Phase 6 operational alerts/events.                                                               |          |

**User's choice:** Recommended option accepted.
**Notes:** Locked toward summarized accounting with detailed employee artifacts and immediate operator visibility on failures.

---

## the agent's Discretion

- Exact schema split between recurring earnings, deductions, and employer/employee contribution components
- Exact BullMQ saga composition and compensation checkpoint boundaries
- Exact PDF template design and storage-key convention
- Exact alert transport path, as long as payroll outcomes are persisted and operator-visible

## Deferred Ideas

None - discussion stayed within phase scope.
