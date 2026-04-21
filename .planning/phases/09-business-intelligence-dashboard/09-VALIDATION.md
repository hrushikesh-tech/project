---
phase: 09
slug: business-intelligence-dashboard
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 09 - Validation Strategy

> Per-phase validation contract and final verification record for execution closeout.

---

## Test Infrastructure

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Framework**          | Node `--test` suites plus targeted manual SSE/report-readability checks |
| **Config file**        | `apps/api/package.json`                                                 |
| **Quick run command**  | `pnpm --filter @amdox/api run test:unit:raw`                            |
| **Full suite command** | `pnpm --filter @amdox/api run test:integration:raw`                     |
| **Estimated runtime**  | ~45 seconds                                                             |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/api run test:unit:raw`
- **After every plan wave:** Run `pnpm --filter @amdox/api run test:integration:raw`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement         | Threat Ref | Secure Behavior                                                          | Test Type   | Automated Command                                   | File Exists | Status |
| -------- | ---- | ---- | ------------------- | ---------- | ------------------------------------------------------------------------ | ----------- | --------------------------------------------------- | ----------- | ------ |
| 09-01-01 | 01   | 1    | BI-01, BI-02, BI-05 | T-09-01    | BI schema evolves without losing tenant scoping or durable report state  | integration | `pnpm --filter @amdox/db db:push`                   | yes         | green  |
| 09-01-02 | 01   | 1    | BI-02, BI-04        | T-09-02    | Shared BI contracts reject unsupported widget and metric combinations    | unit        | `pnpm --filter @amdox/api run test:unit:raw`        | yes         | green  |
| 09-02-01 | 02   | 2    | BI-01, BI-02        | T-09-03    | Dashboard CRUD stays tenant-safe and role-appropriate                    | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |
| 09-03-01 | 03   | 3    | BI-03, BI-04        | T-09-04    | Metric aggregators honor locked finance/HR/supply-chain/forecast rules   | unit        | `pnpm --filter @amdox/api run test:unit:raw`        | yes         | green  |
| 09-03-02 | 03   | 3    | BI-03               | T-09-05    | SSE emits lightweight invalidation events instead of full datasets       | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |
| 09-04-01 | 04   | 4    | BI-05               | T-09-06    | Report scheduling persists run status and artifacts durably              | integration | `pnpm --filter @amdox/api run test:integration:raw` | yes         | green  |
| 09-04-02 | 04   | 4    | BI-05               | T-09-07    | Email/report delivery failures become operator-visible instead of silent | unit        | `pnpm --filter @amdox/api run test:unit:raw`        | yes         | green  |

_Status: pending | green | red | flaky_

---

## Wave 0 Requirements

- [x] `apps/api/test/helpers/bi-test-store.mjs` - reusable dashboard, widget, schedule, and cross-domain BI fixtures
- [x] `apps/api/test/unit/bi.metrics.test.mjs` - fixed-metric aggregation coverage
- [x] `apps/api/test/integration/bi.api.test.mjs` - dashboard CRUD, widget config, and report scheduling API coverage
- [x] `apps/api/test/integration/bi.reports.test.mjs` - report run, artifact metadata, and delivery-path coverage

---

## Manual-Only Verifications

| Behavior                           | Requirement | Why Manual                                                                                            | Test Instructions                                                                                                                                                           |
| ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSE event readability and cadence  | BI-03       | Stream ergonomics and event shape are easier to confirm with a live client than with assertions alone | Subscribe to the dashboard SSE endpoint, confirm one event every ~30 seconds, and verify the payload contains dashboard ID, timestamp, and affected widget/metric keys only |
| PDF and Excel artifact readability | BI-05       | File generation can be automated for existence, but usefulness still needs human inspection           | Trigger a scheduled report run, download both artifacts, confirm the PDF layout is readable and the Excel workbook contains the expected worksheet data                     |

---

## Validation Audit 2026-04-21

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

### Evidence

| Check                                               | Result                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm --filter @amdox/db db:push`                   | Passed; database already in sync with the Prisma schema                                |
| `pnpm --filter @amdox/db generate`                  | Passed                                                                                 |
| `pnpm --filter @amdox/types build`                  | Passed                                                                                 |
| `pnpm --filter @amdox/api build`                    | Passed                                                                                 |
| `pnpm --filter @amdox/api run test:unit:raw`        | Passed; 64/64 tests green                                                              |
| `pnpm --filter @amdox/api run test:integration:raw` | Passed; 16/16 tests green                                                              |
| SSE cadence/manual shape check                      | Passed; first `dashboard.refresh` event observed after ~30017ms                        |
| PDF and Excel artifact readability                  | Passed; PDF header `%PDF`, workbook XML present, dashboard and widget content readable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete
