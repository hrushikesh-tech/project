---
phase: 06
slug: payroll-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 06 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | Node `--test` + Nest integration tests                                                    |
| **Config file**        | `apps/api/package.json`                                                                   |
| **Quick run command**  | `pnpm --filter @amdox/api run test:unit`                                                  |
| **Full suite command** | `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration` |
| **Estimated runtime**  | ~120 seconds                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/api run test:unit`
- **After every plan wave:** Run `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement            | Threat Ref | Secure Behavior                                                                                | Test Type        | Automated Command                                   | File Exists | Status     |
| -------- | ---- | ---- | ---------------------- | ---------- | ---------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- | ----------- | ---------- |
| 06-01-01 | 01   | 1    | PAY-01                 | T-06-01    | Compensation and payroll-run schema remains tenant-scoped and auditable                        | unit             | `pnpm --filter @amdox/api run test:unit`            | ❌ W0       | ⬜ pending |
| 06-02-01 | 02   | 2    | PAY-01, PAY-02         | T-06-02    | Gross-to-net calculation respects employee-specific tax regime, PF, and professional-tax rules | unit             | `pnpm --filter @amdox/api run test:unit`            | ❌ W0       | ⬜ pending |
| 06-03-01 | 03   | 3    | PAY-03, PAY-04, PAY-05 | T-06-03    | Saga processing is tenant-safe, compensates failed GL posting, and never loses run evidence    | integration      | `pnpm --filter @amdox/api run test:integration`     | ❌ W0       | ⬜ pending |
| 06-04-03 | 04   | 4    | PAY-06                 | T-06-04    | Batch processing and artifact generation stay within target throughput assumptions             | integration/perf | `{performance command to be added during planning}` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/test/unit/payroll.engine.test.mjs` - deterministic tax and gross-to-net coverage for PAY-01 and PAY-02
- [ ] `apps/api/test/unit/payroll.queue.test.mjs` - worker and saga transition coverage for PAY-03 and PAY-05
- [ ] `apps/api/test/integration/payroll.api.test.mjs` - API and persistence coverage for payroll run lifecycle
- [ ] `apps/api/test/integration/payroll.worker.test.mjs` - GL integration, payslip storage, and retry/failure orchestration coverage
- [ ] `apps/api/test/perf/payroll.batch.perf.mjs` - throughput verification path for PAY-06
- [ ] `apps/api/test/helpers/payroll-test-store.mjs` - shared payroll/finance/hr harness fixtures
- [ ] `puppeteer` install and test-safe PDF generation seam - required for PAY-04 verification

---

## Manual-Only Verifications

| Behavior                                                                                              | Requirement | Why Manual                                                                                      | Test Instructions                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Verify generated payslip PDF layout is readable and complete for at least one representative employee | PAY-04      | Automated tests can confirm storage and generation, but not document readability/format quality | Run a payroll batch locally, retrieve one stored PDF, and review fields, totals, and tax breakdown visually                                |
| Validate 10,000-employee runtime target under realistic worker concurrency assumptions                | PAY-06      | This is closer to a benchmark/load run than a standard CI test                                  | Seed a large tenant dataset, run the payroll batch job with the planned concurrency, and record total duration plus failure/retry behavior |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
