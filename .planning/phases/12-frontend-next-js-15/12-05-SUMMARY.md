# Plan 12-05 Summary

## Outcome

Implemented the specialized BI and Projects experiences required by Phase 12.

- Added a fixed-semantics dashboard builder using `react-grid-layout`, approved widget controls, persistence hooks, and live invalidation refresh.
- Added the D3-based project Gantt surface with dependency arrows and bounded schedule adjustments.
- Added the large-task layout seam so the Gantt path can be exercised against realistic project scale.

## Verification

- `pnpm --filter @amdox/web run test:unit -- gantt-layout`
- `pnpm --filter @amdox/web run test:e2e -- bi-projects.spec.ts`
- `pnpm --filter @amdox/web build`

## Notes

- The BI builder preserves layout flexibility without allowing free-form metric semantics.
- The Gantt interaction is intentionally bounded and does not expand into client-side auto-scheduling logic.
