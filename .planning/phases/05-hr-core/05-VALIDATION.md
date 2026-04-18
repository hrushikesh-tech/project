---
phase: 05
slug: hr-core
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
---

# Phase 05 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Node test runner + NestJS integration harness                                                                                                                                                                                                                             |
| **Config file**        | `apps/api/package.json`                                                                                                                                                                                                                                                   |
| **Quick run command**  | `pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw`                                                                                                                                                            |
| **Full suite command** | `pnpm --filter @amdox/db db:push --accept-data-loss --skip-generate && pnpm --filter @amdox/db generate && pnpm --filter @amdox/types build && pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw` |
| **Estimated runtime**  | ~100 seconds                                                                                                                                                                                                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw`
- **After every plan wave:** Run `pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** under 100 seconds after environment warmup

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                              | Threat Ref | Secure Behavior                                                                                                    | Test Type        | Automated Command                                                                                                                          | File Exists | Status |
| -------- | ---- | ---- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ |
| 05-01-01 | 01   | 1    | HR-01, HR-03, HR-04, HR-07               | T-05-01    | HR schema and shared contracts preserve tenant-scoped lifecycle, leave, and attendance semantics                   | build            | `pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build`                                                                       | yes         | green  |
| 05-01-02 | 01   | 1    | HR-01, HR-03, HR-04, HR-07               | T-05-02    | Blocking schema push keeps the live database aligned with generated Prisma client and tests                        | build            | `pnpm --filter @amdox/db db:push --accept-data-loss --skip-generate && pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build` | yes         | green  |
| 05-01-03 | 01   | 1    | HR-01, HR-02, HR-04, HR-05, HR-06, HR-07 | T-05-03    | HR harness models tenant-safe employees, departments, leave balances, leave requests, jobs, and attendance records | unit             | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw`                                                                 | yes         | green  |
| 05-02-01 | 02   | 2    | HR-01, HR-03                             | T-05-04    | Route and DTO layer only exposes tenant-safe HR resources through validated Nest endpoints                         | build            | `pnpm --filter @amdox/api build`                                                                                                           | yes         | green  |
| 05-02-02 | 02   | 2    | HR-01, HR-03                             | T-05-05    | Employee lifecycle and department-head rules enforce same-department heads and future-dated termination semantics  | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`                | yes         | green  |
| 05-02-03 | 02   | 2    | HR-02, HR-03                             | T-05-06    | Recursive raw SQL queries remain tenant-filtered and return correct hierarchy depth                                | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`                | yes         | green  |
| 05-02-04 | 02   | 2    | HR-01, HR-02, HR-03                      | T-05-07    | Employee, department, org-chart, and department-tree routes are exercised end to end                               | integration      | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:integration:raw`                                                          | yes         | green  |
| 05-03-01 | 03   | 3    | HR-04                                    | T-05-08    | Leave transitions only allow legal state moves and mutate balances at the correct lifecycle points                 | unit             | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw`                                                                 | yes         | green  |
| 05-03-02 | 03   | 3    | HR-01, HR-05, HR-06                      | T-05-09    | Scheduled HR jobs use explicit tenant scope and prevent duplicate transition side effects                          | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`                | yes         | green  |
| 05-03-03 | 03   | 3    | HR-07                                    | T-05-10    | Attendance capture never guesses clock-out times and keeps correction flows auditable                              | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`                | yes         | green  |
| 05-03-04 | 03   | 3    | HR-04, HR-05, HR-06, HR-07               | T-05-11    | Leave, attendance, and job behaviors are verified end to end including correction and auto-cancel paths            | integration      | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:integration:raw`                                                          | yes         | green  |

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                     | Requirement  | Why Manual                                                                                                     | Test Instructions                                                                                                                                                    |
| -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repeatable HR jobs against live Redis timing | HR-05, HR-06 | Automated coverage invokes processors directly; true scheduler cadence still depends on the live queue runtime | Start the API with Redis available, let the registered jobs run, and confirm accrual, auto-cancel, and effective termination persist exactly once per expected cycle |

---

## Validation Sign-Off

- [x] All tasks have automated verification or Wave 0 coverage
- [x] Sampling continuity has no long unverified stretches
- [x] Wave 0 gaps are covered
- [x] No watch-mode flags are required
- [x] Feedback latency stayed within the target after environment warmup
- [x] `nyquist_compliant: true` is set in frontmatter

**Approval:** complete
