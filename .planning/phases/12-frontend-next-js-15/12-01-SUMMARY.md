---
phase: 12
plan: 01
status: complete
updated: 2026-04-22
---

# 12-01 Summary

## What Changed

- Realigned `apps/web` from Next.js 16 drift to Next.js 15 and added the frontend runtime/tooling stack needed for Phase 12.
- Created the App Router baseline with global styles, provider composition, `(auth)` and `(dashboard)` route-group scaffolding, and a public landing page that exercises shared UI components.
- Promoted `packages/ui` into a real workspace package with button, form-field, and data-table shell primitives.
- Added frontend validation infrastructure with Vitest, Playwright, and test setup files.

## Verification

- `pnpm --filter @amdox/web lint`
- `pnpm --filter @amdox/web typecheck`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web build`

## Outcome

Phase 12 now starts from a real Next.js 15 frontend foundation instead of a placeholder stub, and later plans can build against shared providers, route seams, and reusable UI primitives rather than re-creating baseline infrastructure.
