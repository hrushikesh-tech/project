---
phase: 06
slug: payroll-engine
status: completed
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
---

# Phase 06 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property                | Value                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**           | Node `--test` + Nest integration tests                                                    |
| **Config file**         | `apps/api/package.json`                                                                   |
| **Quick run command**   | `pnpm --filter @amdox/api run test:unit`                                                  |
| **Full suite command**  | `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration` |
| **Performance command** | `pnpm --filter @amdox/api run test:payroll:perf`                                          |
| **Estimated runtime**   | ~120 seconds for unit + integration, ~32 seconds for perf in this environment             |

---

## Sampling Rate

- After every task commit: run `pnpm --filter @amdox/api run test:unit`
- After every plan wave: run `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration`
- Before `/gsd-verify-work`: full suite must be green
- Max feedback latency: 120 seconds for unit/integration feedback

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement            | Threat Ref | Secure Behavior                                                                                        | Test Type        | Automated Command                                | File Exists | Status |
| -------- | ---- | ---- | ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------ | ----------- | ------ |
| 06-01-01 | 01   | 1    | PAY-01                 | T-06-01    | Compensation and payroll-run schema remains tenant-scoped and auditable                                | unit             | `pnpm --filter @amdox/api run test:unit`         | yes         | green  |
| 06-02-01 | 02   | 2    | PAY-01, PAY-02         | T-06-02    | Gross-to-net calculation respects employee-specific tax regime, PF, professional tax, and 87A handling | unit             | `pnpm --filter @amdox/api run test:unit`         | yes         | green  |
| 06-03-01 | 03   | 3    | PAY-03, PAY-04, PAY-05 | T-06-03    | Saga processing is tenant-safe, compensates failed GL posting, and never loses run evidence            | integration      | `pnpm --filter @amdox/api run test:integration`  | yes         | green  |
| 06-04-03 | 04   | 4    | PAY-06                 | T-06-04    | Batch processing and artifact generation stay within target throughput assumptions                     | integration/perf | `pnpm --filter @amdox/api run test:payroll:perf` | yes         | green  |

_Status: pending, green, red, or flaky_

---

## Wave 0 Requirements

- [x] `apps/api/test/unit/payroll.engine.test.mjs` - deterministic tax and gross-to-net coverage for PAY-01 and PAY-02
- [x] `apps/api/test/unit/payroll.queue.test.mjs` - worker and saga transition coverage for PAY-03 and PAY-05
- [x] `apps/api/test/integration/payroll.api.test.mjs` - API and persistence coverage for payroll run lifecycle
- [x] `apps/api/test/integration/payroll.worker.test.mjs` - GL integration, payslip storage, and retry/failure orchestration coverage
- [x] `apps/api/test/perf/payroll.batch.perf.mjs` - throughput verification path for PAY-06
- [x] `apps/api/test/helpers/payroll-test-store.mjs` - shared payroll/finance/hr harness fixtures
- [x] `puppeteer` dependency installed with browser download skipped; runtime uses `PUPPETEER_EXECUTABLE_PATH` or `CHROME_BIN`

---

## Manual-Only Verifications

| Behavior                                                                                              | Requirement | Why Manual                                                                     | Test Instructions                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verify generated payslip PDF layout is readable and complete for at least one representative employee | PAY-04      | Automated tests confirm generation/storage seams, but not document readability | Set `PUPPETEER_EXECUTABLE_PATH` or `CHROME_BIN`, run a real payroll batch, retrieve one stored PDF, and review totals, earnings, deductions, and tax breakdown visually |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for unit/integration
- [x] `nyquist_compliant: true` set in frontmatter

## Execution Record

- `2026-04-18`: `pnpm --filter @amdox/types build`
- `2026-04-18`: `pnpm --filter @amdox/api run test:unit` -> pass
- `2026-04-18`: `pnpm --filter @amdox/api run test:integration` -> pass
- `2026-04-18`: `pnpm --filter @amdox/api run test:payroll:perf` -> pass (`10000` employees in `31871ms`)

**Approval:** ready for sign-off pending one manual PDF review against a real browser binary
