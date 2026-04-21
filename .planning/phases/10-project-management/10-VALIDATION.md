---
phase: 10
slug: project-management
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 10 - Validation Strategy

> Per-phase validation contract and final verification record for execution closeout.

---

## Test Infrastructure

| Property               | Value                                               |
| ---------------------- | --------------------------------------------------- |
| **Framework**          | Node `--test` unit and integration suites           |
| **Config file**        | `apps/api/package.json`                             |
| **Quick run command**  | `pnpm --filter @amdox/api run test:unit:raw`        |
| **Full suite command** | `pnpm --filter @amdox/api run test:integration:raw` |
| **Estimated runtime**  | ~65 seconds                                         |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/api run test:unit:raw`
- **After every plan wave:** Run `pnpm --filter @amdox/api run test:integration:raw`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement         | Threat Ref | Secure Behavior                                                                                                | Test Type   | Automated Command                                   | File Exists | Status |
| -------- | ---- | ---- | ------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------- | ----------- | ------ |
| 10-01-01 | 01   | 1    | PM-01, PM-05        | T-10-01    | Project schema links managers and milestones without breaking tenant-safe access                               | integration | `pnpm --filter @amdox/db db:push`                   | yes         | green  |
| 10-01-02 | 01   | 1    | PM-02               | T-10-02    | Project-domain exceptions and contracts reject invalid dependency operations                                   | unit        | `pnpm --filter @amdox/api run test:unit:raw`        | yes         | green  |
| 10-02-01 | 02   | 2    | PM-01, PM-05        | T-10-03    | CRUD endpoints remain role-gated, tenant-scoped, and auditable                                                 | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |
| 10-03-01 | 03   | 3    | PM-02, PM-04, PM-05 | T-10-04    | DAG validation blocks cycles, milestone recomputation is deterministic, and utilization math stays tenant-safe | unit        | `pnpm --filter @amdox/api run test:unit:raw`        | yes         | green  |
| 10-04-01 | 04   | 4    | PM-03               | T-10-05    | Budget overrun alerts fire once per threshold crossing and leave durable event traces                          | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |
| 10-04-02 | 04   | 4    | PM-01, PM-03        | T-10-06    | BI and audit regressions continue to read shared project data correctly after Phase 10 changes                 | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |

_Status: pending | green | red | flaky_

---

## Wave 0 Requirements

- [x] `apps/api/test/helpers/project-management-test-store.mjs` - reusable project, task, dependency, milestone, employee, notification, and outbox fixtures
- [x] `apps/api/test/unit/project-management.service.test.mjs` - baseline project-domain rule coverage
- [x] `apps/api/test/integration/project-management.api.test.mjs` - tenant-safe CRUD and role-gate coverage
- [x] `apps/api/test/unit/bi.metrics.test.mjs` updates - regression coverage for shared project data

---

## Manual-Only Verifications

All Phase 10 behaviors were automated. No manual-only checks were required for execution closeout.

---

## Validation Audit 2026-04-21

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

### Evidence

| Check                                                                                         | Result                                                                                   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm --filter @amdox/db db:push`                                                             | Passed after elevated retry; local PostgreSQL schema is in sync with the Phase 10 schema |
| `pnpm --filter @amdox/db generate`                                                            | Passed                                                                                   |
| `pnpm --filter @amdox/types build`                                                            | Passed                                                                                   |
| `pnpm --filter @amdox/db build`                                                               | Passed                                                                                   |
| `pnpm --filter @amdox/api build`                                                              | Passed                                                                                   |
| `node --test --test-isolation=none apps/api/test/unit/project-management.service.test.mjs`    | Passed; 4/4 project-management unit tests green                                          |
| `node --test --test-isolation=none apps/api/test/integration/project-management.api.test.mjs` | Passed; 1/1 project-management integration tests green                                   |
| `node --test --test-isolation=none apps/api/test/unit/bi.metrics.test.mjs`                    | Passed; 3/3 BI regression tests green                                                    |
| `pnpm --filter @amdox/api run test:unit:raw`                                                  | Passed; 68/68 tests green                                                                |
| `pnpm --filter @amdox/api run test:integration:raw`                                           | Passed; 17/17 tests green                                                                |

---

## Validation Sign-Off

- [x] All tasks have automated verify steps or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete
