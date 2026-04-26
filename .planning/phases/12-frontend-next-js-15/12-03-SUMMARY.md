# Plan 12-03 Summary

## Completed

- Added the shared operational frontend layer for dense ERP work:
  - `apps/web/src/components/data-table/app-data-table.tsx`
  - `apps/web/src/components/forms/app-form.tsx`
  - `apps/web/src/components/module-home/module-home-hero.tsx`
- Expanded the typed web client seams in `apps/web/src/lib/api/client.ts` and kept the query-key map in `apps/web/src/lib/query/keys.ts`.
- Delivered Finance, AP/AR, HR, and notification-preference module routes under the real app tree:
  - `app/(dashboard)/dashboard/finance`
  - `app/(dashboard)/dashboard/ap-ar`
  - `app/(dashboard)/dashboard/hr`
  - `app/(dashboard)/dashboard/notifications`
- Implemented the journal-entry builder with dynamic lines, live debit/credit balance feedback, and FX preview in `apps/web/src/components/finance/journal-entry-builder.tsx`.
- Enabled the corresponding shell navigation in `apps/web/src/lib/routes.ts`.
- Added automated coverage:
  - `apps/web/tests/unit/operational-ui.test.tsx`
  - `apps/web/tests/e2e/finance-apar-hr.spec.ts`

## Verification

- `pnpm --filter @amdox/web lint` passed
- `pnpm --filter @amdox/web typecheck` passed
- `pnpm --filter @amdox/web run test:unit -- operational-ui` passed
- `pnpm --filter @amdox/web build` passed

## Remaining Note

- The new protected-shell browser spec exists, but the local Playwright run is still blocked by stale frontend process orchestration on ports `3000` and `3001`. This is an environment issue around which local web server is currently serving traffic, not a TypeScript/build failure in the new 12-03 code.
