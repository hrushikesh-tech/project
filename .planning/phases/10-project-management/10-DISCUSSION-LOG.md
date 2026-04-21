# Phase 10: Project Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `10-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-21T15:51:03+05:30
**Phase:** 10-project-management
**Areas discussed:** actual cost source, resource utilization meaning, milestone linkage, manager ownership, budget overrun alert behavior, dependency and milestone boundary rules

---

## Actual Cost Source

| Option                                                   | Description                                                                    | Selected |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Manual project-level updates only                        | Keep `Project.actualCost` manual and separate from task hours                  | X        |
| Roll up from task actual hours using employee cost rates | More automatic, but needs labor-rate data the project does not currently model |          |
| Hybrid cost rollup plus manual adjustments               | Mixed model with more implementation complexity                                |          |
| Custom                                                   | User-defined alternative                                                       |          |

**User's choice:** Manual project-level updates only.
**Notes:** The user selected `1A`, keeping Phase 10 aligned to the existing schema and avoiding a premature labor-cost model.

---

## Resource Utilization Meaning

| Option                                     | Description                                                                                                                     | Selected |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Planning-oriented utilization              | `allocatedHours` from assigned open-task estimates and `availableHours` from standard capacity adjusted for leave/active status | X        |
| Actual-work utilization                    | `allocatedHours` from actual hours and `availableHours` from attendance-derived worked hours                                    |          |
| Expose both planned and actual utilization | Richer output but broader scope                                                                                                 |          |
| Custom                                     | User-defined alternative                                                                                                        |          |

**User's choice:** Planning-oriented utilization.
**Notes:** The user selected `2A`, which fits the current task and HR data better than an attendance-heavy retrospective calculation.

---

## Milestone-to-Task Linkage

| Option                                    | Description                                                                    | Selected |
| ----------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Explicit task-to-milestone linkage        | Link tasks directly so milestone status can derive from linked task completion | X        |
| Join table allowing multi-milestone tasks | More flexible but more complex than needed for this phase                      |          |
| Manual milestone status updates           | Simpler, but does not satisfy the success criterion cleanly                    |          |
| Custom                                    | User-defined alternative                                                       |          |

**User's choice:** Explicit task-to-milestone linkage.
**Notes:** The user selected `3A`, favoring direct milestone derivation from linked task state.

---

## Project Manager Ownership Model

| Option                                       | Description                                                     | Selected |
| -------------------------------------------- | --------------------------------------------------------------- | -------- |
| Manager must reference `Employee`            | Aligns ownership with HR lifecycle, leave, and utilization data | X        |
| Manager references `User`                    | Simpler auth-wise but weaker for HR/resource reporting          |          |
| Allow either employee or external identifier | Flexible but weaker consistency and more validation complexity  |          |
| Custom                                       | User-defined alternative                                        |          |

**User's choice:** Manager must reference `Employee`.
**Notes:** The user selected `4A`, anchoring project ownership to HR-backed employee records.

---

## Budget Overrun Alert Behavior

| Option                                                                                                                        | Description                                                              | Selected |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| Alert project manager and tenant admins, fire once at first `>= 10%` crossing, and record a durable outbox/notification event | Recommended Phase 10 behavior before the full notification engine exists | X        |
| Alternative alerting behavior                                                                                                 | Different recipients, repeat behavior, or delivery contract              |          |

**User's choice:** Use the recommended default.
**Notes:** The user accepted the recommended default so Phase 10 can satisfy the alerting success criterion without depending on Phase 11 delivery channels.

---

## Dependency and Milestone Boundary Rules

| Option                                                                                                                            | Description                                                         | Selected |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Dependencies only within one project, task completion means `DONE`, and milestones complete only when all linked tasks are `DONE` | Recommended default aligned to the roadmap success criteria         | X        |
| Alternative dependency/milestone boundary behavior                                                                                | Different project scope, completion rule, or milestone status logic |          |

**User's choice:** Use the recommended default.
**Notes:** The user accepted the recommended default, keeping dependency validation and milestone completion tightly aligned with the phase goals.

---

## the agent's Discretion

- Exact DTOs, endpoint names, and module/service split
- Exact capacity constant or configuration surface for available-hours calculations
- Exact schema implementation for milestone linkage, as long as linked-task completion drives milestone completion
- Exact persistence details for suppressing repeated overrun alerts

## Deferred Ideas

- Labor-rate-driven automatic project costing
- Cross-project dependencies
- Multi-milestone task membership
- Advanced scheduling beyond DAG validation
- Rich notification delivery behavior beyond durable event creation
