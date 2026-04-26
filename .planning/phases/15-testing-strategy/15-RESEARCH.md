# Phase 15: Testing Strategy - Research

**Researched:** 2026-04-25
**Domain:** Coverage enforcement, harness-backed endpoint verification, real-stack smoke testing, Playwright journey formalization, shared test utilities, and k6 load validation
**Confidence:** MEDIUM-HIGH

## Summary

Phase 15 should be planned as a test-platform consolidation phase, not a framework migration. The repo already has substantial automated coverage foundations: backend unit and integration tests run on the raw Node test runner, frontend checks use Vitest and Playwright, and Phase 12 plus Phase 14 already proved strong browser and security regression seams. The highest-value work is to make those seams comprehensive, measurable, and reusable rather than replacing them. [VERIFIED: `apps/api/package.json`] [VERIFIED: `apps/web/package.json`] [VERIFIED: `.planning/phases/12-frontend-next-js-15/12-VALIDATION.md`] [VERIFIED: `.planning/phases/14-security-hardening/14-VALIDATION.md`]

The repo’s current test shape creates four planning implications:

1. The backend already has a large harness-backed integration surface, so `TEST-02` should expand and normalize that matrix instead of moving every route to a live-stack test harness. [VERIFIED: `apps/api/test/integration/*.test.mjs`] [VERIFIED: `apps/api/test/helpers/app-platform.mjs`]
2. The project does not yet expose meaningful coverage commands or thresholds, so `TEST-01` needs explicit script/reporting work before “>=80% on all service classes” becomes enforceable. [VERIFIED: `apps/api/package.json`] [VERIFIED: `apps/web/package.json`] [VERIFIED: repo grep for `--coverage|c8|k6`]
3. The frontend already has 7 Playwright specs that cover most of the intended business surface, so `TEST-03` should formalize 8 required journeys by regrouping and extending what exists. [VERIFIED: `apps/web/tests/e2e/auth.spec.ts`] [VERIFIED: `apps/web/tests/e2e/finance-apar-hr.spec.ts`] [VERIFIED: `apps/web/tests/e2e/payroll-supply-chain.spec.ts`] [VERIFIED: `apps/web/tests/e2e/bi-projects.spec.ts`] [VERIFIED: `apps/web/tests/e2e/offline-a11y.spec.ts`]
4. There is no k6 wiring in the repo today, so `TEST-05` is greenfield and should be bounded to an API-heavy mixed workload rather than an unrealistic attempt to simulate every ERP path equally. [VERIFIED: repo grep for `k6`]

The cleanest implementation split is:

1. Coverage/reporting and shared test utility standardization
2. Full API endpoint matrix plus a small real-stack smoke layer
3. Formal 8-journey Playwright suite consolidation
4. k6 load scenarios and phase-close validation evidence

## Codebase Findings

### Existing backend test infrastructure

- `apps/api/package.json` already exposes `test:unit:raw` and `test:integration:raw`, both based on the raw Node test runner.
- Integration suites compile against `dist` output and then boot a Nest app with overridden providers; this is consistent but still carries stale-build risk if coverage or smoke commands do not force a build first.
- `apps/api/test/helpers/app-platform.mjs` centralizes the Phase 13 API-platform contract (`/api/v1`, request IDs, response envelopes), making it the right seam for broad route verification.
- `apps/api/test/helpers/*.mjs` already includes domain stores for finance, AP/AR, HR, payroll, forecasting, BI, notifications, project management, and supply chain, which means helper standardization should unify and compose them rather than replace them.

### Existing API coverage surface

- The backend currently contains 17 controller files across health, auth, forecasting, finance, AP/AR, HR, notifications, payroll, BI, project management, and supply chain. [VERIFIED: repo controller listing]
- The route surface is broad enough that “every endpoint has happy-path and error-path coverage” should be planned as systematic matrix work, not ad hoc additions inside one or two suites.
- Cross-tenant denial assertions already appear in some module suites, which means Phase 15 can treat those as a pattern for negative-path endpoint coverage rather than inventing a new philosophy. [VERIFIED: `apps/api/test/integration/finance.api.test.mjs`] [VERIFIED: `.planning/phases/14-security-hardening/14-VALIDATION.md`]

### Existing frontend/E2E coverage surface

- `apps/web/tests/e2e` already contains 7 specs:
  - `auth.spec.ts`
  - `auth-live.spec.ts`
  - `finance-apar-hr.spec.ts`
  - `payroll-supply-chain.spec.ts`
  - `bi-projects.spec.ts`
  - `offline-a11y.spec.ts`
  - `phase12-human-verification.spec.ts`
- `apps/web/tests/e2e/helpers.ts` already provides shared login behavior and environment helpers.
- The current Playwright config expects a local Next.js dev server on `http://localhost:3010` unless `PLAYWRIGHT_EXTERNAL_SERVER=1`, which is a workable contract for formal journey execution. [VERIFIED: `apps/web/playwright.config.ts`]

### Coverage and load-test gaps

- Neither the root nor package-level scripts currently expose an enforced coverage command (`--coverage`, `c8`, or similar), so there is no truthful baseline for `TEST-01` yet.
- There is no shared helper API matching the exact requirement names `createTestTenant`, `createTestUser`, `cleanupTestTenant`, `mockKeycloak`, `seedFinanceData`, and `seedInventoryData`; the ingredients exist, but not the standardized entrypoints.
- There is no k6 directory, script, or scenario runner in the repo today.

## Recommended Technical Direction

### 1. Add explicit coverage wiring before trying to raise percentages

The repo cannot meet `TEST-01` by policy alone. Phase 15 should first introduce concrete coverage commands and threshold logic, ideally:

- backend coverage reporting that targets core service logic
- frontend unit coverage reporting where it adds value
- thresholds that are strict on service classes and advisory on thin transport layers

Because the user explicitly chose a service-focused hard floor, the implementation should avoid blunt repo-wide gating that punishes DTO and controller files equally.

### 2. Keep the endpoint matrix on the harness path, then add a small real-stack smoke tier

The harness-backed integration pattern already reaches most route contracts quickly. It should remain the primary vehicle for `TEST-02`.

The higher-fidelity gap is not route variety but runtime truth. A small smoke layer should prove:

- the built API can boot against live infrastructure
- database and Redis-backed seams behave truthfully
- auth/session paths still work end to end

That smaller live-stack tier should be smoke-only, not a second full matrix.

### 3. Formalize business journeys instead of keeping a file-oriented Playwright suite

The strongest existing browser tests are already cross-module. Phase 15 should map them to 8 named business journeys such as:

- auth and protected-shell entry
- finance journal and reporting flow
- AP/AR invoice and aging flow
- HR leave/attendance flow
- payroll run and payslip/admin flow
- supply-chain purchasing/inventory flow
- BI dashboard/project planning flow
- offline/accessibility resilience flow

That keeps the suite aligned with product confidence rather than page trivia.

### 4. Standardize helper entrypoints over the current domain stores

`TEST-04` should not be interpreted as “replace the current helpers with a perfect fixture framework.” The current stores are already useful. The missing piece is a stable public helper surface that future tests can call consistently:

- `createTestTenant`
- `createTestUser`
- `cleanupTestTenant`
- `mockKeycloak`
- `seedFinanceData`
- `seedInventoryData`

Those helpers can internally delegate to the current domain harnesses.

### 5. Keep k6 focused on platform-critical API pressure

Because the repo’s SLA target is `<300ms P95` and `>=2,000 concurrent users per tenant`, the best k6 plan is an API-heavy mixed scenario:

- auth/session-sensitive routes
- common CRUD and list endpoints
- BI reads
- a bounded heavy slice such as payroll-sensitive or report-like traffic

This is a better validation layer than trying to mimic every ERP workflow with equal weight.

## Risks And Planning Traps

### 1. Coverage can become noisy if service targeting is not explicit

If plans do not define which files count as “service classes,” the repo will either under-enforce the requirement or drift into controller/DTO percentage fights that the user explicitly rejected.

### 2. Harness breadth can hide real runtime regressions

The current harness pattern is fast and useful, but it does not prove real Postgres/Redis/auth runtime behavior. That is why the real-stack smoke tier matters.

### 3. E2E inflation is easy

If every current Playwright file is preserved as-is and new “journey” specs are added on top, the suite will become redundant and slower without increasing confidence.

### 4. Helper standardization can sprawl

Trying to invent a universal fixture DSL in one phase would drag the work away from the concrete helper names the requirement actually asks for.

### 5. k6 can become decorative

Without an explicit scenario mix, environment contract, and pass/fail metrics, the load suite will exist on paper but not provide trustworthy confidence.

## Validation Architecture

Phase 15 should validate across five layers:

1. **Coverage truth** - reporting commands exist and thresholds are enforceable on the intended service surface.
2. **Endpoint truth** - every API endpoint has happy-path and error-path coverage through the standardized integration matrix.
3. **Runtime truth** - a smaller live-stack smoke suite proves real infrastructure/auth seams.
4. **Journey truth** - 8 named Playwright business journeys pass consistently.
5. **Performance truth** - k6 scenarios measure P95 latency and error-rate behavior against the required concurrency target.

Recommended execution commands during implementation:

- `pnpm --filter @amdox/api run build`
- `pnpm --filter @amdox/api run test:unit:raw`
- `pnpm --filter @amdox/api run test:integration:raw`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web run test:e2e -- --workers=1`
- `pnpm --filter @amdox/api run test:smoke` or equivalent live-stack smoke command added in this phase
- `pnpm run test:load` or equivalent k6 entrypoint added in this phase

## Planning Implication

The cleanest plan split for Phase 15 is:

1. **Coverage + helper foundation**  
   Add coverage/reporting commands and thresholds, standardize shared helper entrypoints, and make the validation contract truthful.
2. **API matrix + live smoke**  
   Expand integration coverage to the full endpoint surface and add a smaller real-stack smoke layer for infrastructure truth.
3. **Playwright journeys**  
   Formalize 8 business-critical browser journeys by regrouping and extending the current E2E specs.
4. **Load + closeout**  
   Add k6 scenarios, wire repeatable load commands, and update `15-VALIDATION.md` with final evidence.
