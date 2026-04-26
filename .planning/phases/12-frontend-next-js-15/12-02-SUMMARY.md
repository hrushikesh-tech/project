---
phase: 12
plan: 02
status: complete
updated: 2026-04-22
---

# 12-02 Summary

## What Changed

- Added Auth.js/NextAuth v5 credentials-based integration in `apps/web/src/auth.ts`, backed by the existing `/api/v1/auth/login`, `/refresh`, `/logout`, and `/me` API contract.
- Implemented token refresh/logout helpers, a protected `/dashboard` route, route middleware, and a role-home resolver tied to backend roles.
- Replaced the placeholder dashboard shell with a real unified shell using `AppShell`, `SidebarNav`, and `Topbar`.
- Upgraded the login page into a working client-side sign-in flow and added initial unit plus Playwright auth coverage.
- Added `AUTH_SECRET` guidance to `.env.example` and a dev fallback so local verification works immediately.

## Verification

- `pnpm --filter @amdox/web lint`
- `pnpm --filter @amdox/web typecheck`
- `pnpm --filter @amdox/web run test:unit -- auth-shell`
- `pnpm --filter @amdox/web run test:e2e -- auth.spec.ts`
- `pnpm --filter @amdox/web build`

## Outcome

The frontend now has a real protected ERP entry path: unauthenticated users are redirected to login, the shell is tenant/role aware, and the auth bridge honors the backend Keycloak-aligned contract instead of inventing a separate frontend session model.
