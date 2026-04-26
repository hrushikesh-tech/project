---
phase: 15
plan: 04
created: 2026-04-25
status: completed
---

# Phase 15 Plan 04 Summary

## What Changed

- Added a root `test:load` command that routes through `tests/load/run-k6.ps1`.
- Added a k6-style API-heavy mixed workload in `tests/load/api-mixed.js` covering auth/session traffic, finance reads, BI reads, payroll reads, and a heavier finance report path.
- Encoded explicit thresholds for `http_req_failed`, `http_req_duration` P95, and overall check pass rate.

## Verification

- `pnpm run test:load`
- `pnpm --filter @amdox/api run test:integration:raw`
- `pnpm --filter @amdox/web run test:e2e -- --workers=1`
- `rg "test:load|k6|P95|error rate|2000" .planning/phases/15-testing-strategy/15-VALIDATION.md tests/load package.json`

## Notes

- The load suite is wired and truthfully expresses the Phase 15 workload shape, but an actual k6 binary or a running Docker daemon is still required to execute it.
- Final SLA evidence depends on running the suite against a representative local stack with live auth credentials.
