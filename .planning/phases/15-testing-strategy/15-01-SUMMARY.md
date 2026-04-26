---
phase: 15
plan: 01
created: 2026-04-25
status: completed
---

# Phase 15 Plan 01 Summary

## What Changed

- Added a real backend coverage gate in `apps/api/package.json` with `test:unit:coverage`, built on Node's native test coverage and scoped to `dist/src/**/*.service.js`.
- Added `apps/api/test/helpers/test-fixtures.mjs` with the standardized Phase 15 helper API:
  - `createTestTenant`
  - `createTestUser`
  - `cleanupTestTenant`
  - `mockKeycloak`
  - `seedFinanceData`
  - `seedInventoryData`
- Added reusable finance and supply-chain seeding helpers to the existing harness modules.
- Updated `15-VALIDATION.md` so coverage references the real command names and keeps smoke/load work deferred to later plans.

## Verification

- `pnpm --filter @amdox/api run build`
- `pnpm --filter @amdox/api run test:unit:coverage`
- `rg "createTestTenant|createTestUser|cleanupTestTenant|mockKeycloak|seedFinanceData|seedInventoryData" apps/api/test/helpers/test-fixtures.mjs`
- `rg "coverage|test:smoke|test:load" .planning/phases/15-testing-strategy/15-VALIDATION.md apps/api/package.json apps/web/package.json`

## Notes

- The new coverage command is wired and truthful, but the current unit baseline is still red from pre-existing AP/AR upload and tenant-guard regressions outside the Wave 1 fixture changes.
- Frontend coverage was intentionally left advisory in this plan to preserve the user-selected hard floor on backend service classes.
