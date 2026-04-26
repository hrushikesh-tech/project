---
phase: 12
slug: frontend-next-js-15
status: complete
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-21
updated: 2026-04-23
---

# Phase 12 - Validation Strategy

## Current Status

Plans `12-01` through `12-06` are implemented and verified. Automated verification covers the full frontend surface with a passing unit suite, a passing production build, and a passing serial Playwright suite against the clean frontend-owned Next.js 15 dev server on `http://localhost:3010`. The final `12-06` UX gate was completed on 2026-04-23 through an assisted browser walkthrough delegated by the user, with screenshot evidence captured for the role-home shell, BI builder, Gantt surface, and offline queue experience.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library + Playwright |
| Config files | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter @amdox/web run test:unit` |
| Full app verification | `pnpm --filter @amdox/web lint && pnpm --filter @amdox/web typecheck && pnpm --filter @amdox/web build` |
| Auth journey | `pnpm --filter @amdox/web run test:e2e -- auth.spec.ts` |
| Live credential journey | `pnpm --filter @amdox/web run test:e2e -- auth-live.spec.ts` |
| Full unit suite | `pnpm --filter @amdox/web run test:unit` |
| Full serial e2e suite | `pnpm --filter @amdox/web run test:e2e -- --workers=1` |

## Verified Evidence

| Slice | Evidence | Result | Date |
|------|----------|--------|------|
| Wave 1 baseline | `pnpm --filter @amdox/web lint` | passed | 2026-04-22 |
| Wave 1 baseline | `pnpm --filter @amdox/web typecheck` | passed | 2026-04-22 |
| Wave 1 baseline | `pnpm --filter @amdox/web run test:unit` | passed (`passWithNoTests` before shell tests existed) | 2026-04-22 |
| Wave 1 baseline | `pnpm --filter @amdox/web build` | passed on Next.js 15.5.15 | 2026-04-22 |
| Wave 2 auth/shell | `pnpm --filter @amdox/web run test:unit -- auth-shell` | passed (3 tests) | 2026-04-22 |
| Wave 2 auth/shell | `pnpm --filter @amdox/web run test:e2e -- auth.spec.ts` | passed (2 tests) | 2026-04-22 |
| Wave 2 auth/shell | `pnpm --filter @amdox/web run test:e2e -- auth-live.spec.ts` | passed against real Keycloak-backed credentials via temporary auth proxy | 2026-04-22 |
| Wave 2 auth/shell | `pnpm --filter @amdox/web build` | passed with `/dashboard` and `/api/auth/[...nextauth]` routes | 2026-04-22 |
| Wave 3 operational modules | `pnpm --filter @amdox/web run test:e2e -- finance-apar-hr.spec.ts` | passed | 2026-04-23 |
| Wave 4 payroll + supply chain + notifications | `pnpm --filter @amdox/web run test:unit -- inventory-heatmap` | passed | 2026-04-23 |
| Wave 4 payroll + supply chain + notifications | `pnpm --filter @amdox/web run test:e2e -- payroll-supply-chain.spec.ts` | passed | 2026-04-23 |
| Wave 5 BI + Gantt | `pnpm --filter @amdox/web run test:unit -- gantt-layout` | passed | 2026-04-23 |
| Wave 5 BI + Gantt | `pnpm --filter @amdox/web run test:e2e -- bi-projects.spec.ts` | passed | 2026-04-23 |
| Wave 6 offline + a11y closeout | `pnpm --filter @amdox/web run test:e2e -- offline-a11y.spec.ts` | passed | 2026-04-23 |
| Full frontend closeout | `pnpm --filter @amdox/web run test:unit` | passed (4 files, 9 tests) | 2026-04-23 |
| Full frontend closeout | `pnpm --filter @amdox/web lint` | passed | 2026-04-23 |
| Full frontend closeout | `pnpm --filter @amdox/web typecheck` | passed | 2026-04-23 |
| Full frontend closeout | `pnpm --filter @amdox/web build` | passed on Next.js 15.5.15 with all dashboard routes and manifest | 2026-04-23 |
| Full frontend closeout | `pnpm --filter @amdox/web run test:e2e -- --workers=1` | passed (7 tests) | 2026-04-23 |
| Assisted UX gate | `pnpm --filter @amdox/web run test:e2e -- phase12-human-verification.spec.ts` | passed with screenshots at 375px, 768px, and 1440px plus offline queue evidence | 2026-04-23 |
| Lighthouse login audit | `lighthouse http://localhost:3011/login` | passed: Performance 100, Accessibility 100, Best Practices 96 | 2026-04-23 |
| Lighthouse home audit | `lighthouse http://localhost:3011/` | passed: Performance 100, Accessibility 100, Best Practices 100 | 2026-04-23 |

## Per-Plan Verification Map

| Plan | Scope | Automated verification | Status |
|------|-------|------------------------|--------|
| 12-01 | Next.js 15 alignment, route-group shell, shared providers, UI primitives, test baseline | `lint`, `typecheck`, `test:unit`, `build` | complete |
| 12-02 | Auth.js contract bridge, middleware protection, role-home shell, initial auth tests | `lint`, `typecheck`, `test:unit -- auth-shell`, `test:e2e -- auth.spec.ts`, `build` | complete |
| 12-03 | Shared operational data/form layer plus Finance, AP/AR, HR, Notifications prefs | `lint`, `typecheck`, `test:unit -- operational-ui`, `build`, `test:e2e -- finance-apar-hr.spec.ts` passed | complete |
| 12-04 | Payroll, Supply Chain, Notifications center | `test:unit -- inventory-heatmap`, `test:e2e -- payroll-supply-chain.spec.ts`, `build` | complete |
| 12-05 | BI builder and D3 Gantt | `test:unit -- gantt-layout`, `test:e2e -- bi-projects.spec.ts`, `build` | complete |
| 12-06 | Offline/PWA, accessibility hardening, final closeout | `lint`, `typecheck`, `test:unit`, `test:e2e -- offline-a11y.spec.ts`, `test:e2e -- --workers=1`, `test:e2e -- phase12-human-verification.spec.ts`, `build` | complete |

## Wave 0 Requirements

- [x] `apps/web/vitest.config.ts`
- [x] `apps/web/playwright.config.ts`
- [x] `apps/web/tests/setup.ts`
- [x] `apps/web/src/providers/app-providers.tsx`
- [x] `apps/web/tests/unit/auth-shell.test.tsx`
- [x] `apps/web/tests/e2e/auth.spec.ts`

## Known Non-Blocking Notes

- Playwright now runs against `http://localhost:3010` for clean frontend-owned dev-server execution during closeout verification.
- Auth.js now has a dev-safe fallback secret in code, but real environments should set `AUTH_SECRET`.
- The live credential proof used a temporary `scripts/phase12-auth-proxy.mjs` bridge to a real Keycloak instance on `http://localhost:8081` because the local Nest API process is currently broken by a `@nestjs/core` runtime module-resolution issue. The frontend credential flow itself is verified; the local API boot issue remains a separate workspace problem.
- The full credentialed Playwright suite is stable when run serially with `--workers=1`. Parallel live-login execution can trigger intermittent `invalid_grant` responses from the auth backend, so serial execution is the reliable closeout command in this environment.
- Formal Lighthouse reports were captured against the production server on `http://localhost:3011` for `/` and `/login`.
- The audited scores exceeded the `>= 90` target on the measured routes:
  - `/`: Performance 100, Accessibility 100, Best Practices 100
  - `/login`: Performance 100, Accessibility 100, Best Practices 96
- Protected-shell Lighthouse automation was not captured as a separate authenticated report from the production server because session acquisition outside the Playwright test harness was not stable enough to treat as reliable evidence in this environment.
- Assisted UX screenshots were captured at:
  - `apps/web/test-results/manual-phase12-mobile-dashboard.png`
  - `apps/web/test-results/manual-phase12-tablet-bi.png`
  - `apps/web/test-results/manual-phase12-desktop-projects.png`
  - `apps/web/test-results/manual-phase12-desktop-offline.png`
- Lighthouse report files were saved at:
  - `apps/web/lighthouse-reports/home-audit.report.html`
  - `apps/web/lighthouse-reports/home-audit.report.json`
  - `apps/web/lighthouse-reports/login-audit.report.html`
  - `apps/web/lighthouse-reports/login-audit.report.json`

## Remaining Validation Work

- Optionally add a separate authenticated Lighthouse capture for the protected shell later if you want route-specific score evidence for post-login ERP pages.
