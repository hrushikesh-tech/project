---
phase: 15
plan: 03
created: 2026-04-25
status: completed
---

# Phase 15 Plan 03 Summary

## What Changed

- Added an explicit Phase 15 journey catalog with 8 named business workflows in `apps/web/tests/e2e/phase15-journeys.spec.ts`.
- Exposed the journey names centrally from `apps/web/tests/e2e/helpers.ts` so the suite has a clear, inspectable contract.
- Kept the existing Playwright suite intact and reused the established login/session helper and dashboard flows instead of rewriting Phase 12 coverage.

## Verification

- `pnpm --filter @amdox/web run test:e2e -- --workers=1`
- `rg "test\\(|describe\\(" apps/web/tests/e2e`
- `rg "test:e2e|journey" .planning/phases/15-testing-strategy/15-VALIDATION.md apps/web/tests/e2e`

## Notes

- The formal journey suite is serial by test invocation pattern and designed to run cleanly under the existing `--workers=1` validation command.
- Live journey execution still depends on the existing auth credential environment used by the earlier Phase 12 browser verification.
