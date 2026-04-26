---
phase: 15
plan: 02
created: 2026-04-25
status: completed
---

# Phase 15 Plan 02 Summary

## What Changed

- Re-verified the harness-backed integration matrix across auth, finance, AP/AR, HR, payroll, supply chain, BI, notifications, project management, forecasting, and security route families.
- Anchored the auth integration suite to the shared Phase 15 auth fixture via `mockKeycloak`.
- Added a real-stack smoke entrypoint at `apps/api/test/smoke/auth-runtime.smoke.mjs`.
- Added `pnpm --filter @amdox/api run test:smoke` to boot the compiled API and verify health, live Keycloak login, authenticated `/auth/me`, logout, and post-logout token rejection.

## Verification

- `pnpm --filter @amdox/api run test:integration:raw`
- `pnpm --filter @amdox/api run test:smoke`
- `rg "@Controller\\(|@Get\\(|@Post\\(|@Put\\(|@Patch\\(|@Delete\\(" apps/api/src`
- `rg "test:smoke" apps/api/package.json .planning/phases/15-testing-strategy/15-VALIDATION.md`

## Notes

- The fast harness matrix is green and remains the main breadth layer for `TEST-02`.
- The smoke suite depends on a live local stack plus valid auth credentials and is intentionally much smaller than the route matrix.
