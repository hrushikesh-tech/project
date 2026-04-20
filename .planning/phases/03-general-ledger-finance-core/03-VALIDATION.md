---
phase: 03
slug: general-ledger-finance-core
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
verified_at: 2026-04-19
---

# Phase 03 - Validation Strategy

## Test Infrastructure

| Property           | Value                                           |
| ------------------ | ----------------------------------------------- |
| Framework          | Node `--test` + Nest integration tests          |
| Config file        | `apps/api/package.json`                         |
| Quick run command  | `pnpm --filter @amdox/api run test:unit`        |
| Full suite command | `pnpm --filter @amdox/api run test:integration` |

## Verification Map

| Requirement                    | Evidence                                                                    | Status |
| ------------------------------ | --------------------------------------------------------------------------- | ------ |
| FIN-01, FIN-02, FIN-03, FIN-04 | `apps/api/test/unit/finance.service.test.mjs`                               | green  |
| FIN-05                         | `apps/api/test/unit/finance.service.test.mjs` and FX service implementation | green  |
| FIN-06, FIN-07, FIN-08         | `apps/api/test/integration/finance.api.test.mjs`                            | green  |

## Execution Record

- `2026-04-19`: `pnpm --filter @amdox/api run test:unit` -> pass
- `2026-04-19`: `pnpm --filter @amdox/api run test:integration` -> pass

**Approval:** verified from current codebase and passing finance unit/integration coverage.
