# Phase 15: Testing Strategy - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Raise the ERP test strategy to a release-grade baseline by enforcing meaningful unit coverage on service logic, expanding API integration coverage to the full endpoint surface, formalizing eight critical Playwright end-to-end journeys, standardizing reusable test utilities, and adding k6 load verification for the platform's core runtime paths.

This phase strengthens confidence in the product that already exists across Phases 12 through 14. It does not introduce new business capabilities, replace the current test stack wholesale, or move CI/CD ownership, production observability, or Kubernetes rollout work forward from later phases.

</domain>

<decisions>
## Implementation Decisions

### Coverage Gate

- **D-01:** The `>=80%` line-coverage target should be enforced as a meaningful floor on core service logic rather than as a blanket rule on every thin transport or DTO file.
- **D-02:** Core backend service classes are the primary hard target for `TEST-01`.
- **D-03:** Thin controller, DTO, and transport-wrapper layers may remain advisory-only for coverage as long as their behavior is protected by integration or E2E tests where appropriate.

### Integration Test Contract

- **D-04:** Phase 15 should keep the existing harness-backed Nest integration style as the main way to achieve full endpoint coverage.
- **D-05:** Phase 15 should add a smaller real-stack smoke layer against live Postgres, Redis, and auth/runtime seams instead of trying to migrate the entire endpoint matrix to live-stack tests.
- **D-06:** The real-stack layer is meant to catch environment and wiring drift that the harness cannot prove, not to replace the broad harness matrix.

### E2E Journey Definition

- **D-07:** The required 8 Playwright journeys should be framed as business-critical cross-module workflows, not just isolated page checks.
- **D-08:** Existing strong Phase 12 Playwright coverage should be reused wherever it already proves one of those business journeys.
- **D-09:** Phase 15 should consolidate and elevate the current E2E suite into an explicit product-level journey set instead of inventing an unrelated browser test catalog from scratch.

### Test Utilities Scope

- **D-10:** Phase 15 should standardize and clean up the existing helper and harness surface first.
- **D-11:** The current `apps/api/test/helpers` stores and platform helpers are the baseline to build on rather than something to discard immediately.
- **D-12:** Utility work should focus on shared helpers such as tenant/user creation, cleanup, auth mocking, and domain seed data so future tests stop re-implementing those seams ad hoc.

### Load Test Focus

- **D-13:** k6 should target an API-heavy mixed workload instead of attempting to simulate every ERP feature equally.
- **D-14:** The primary load mix should include auth/session-sensitive paths, common CRUD traffic, BI read traffic, and a bounded set of heavier routes.
- **D-15:** Phase 15 load testing should optimize for truthful platform confidence against the roadmap's 2,000-user and P95/error-rate goals, not for exhaustive workflow realism.

### the agent's Discretion

- Exact file-level definition of which backend classes count as core service logic for the hard coverage gate
- Exact split between per-package coverage reporting, per-file thresholds, and any aggregate reporting layer needed to make the gate usable
- Exact shape of the smaller real-stack smoke suite, so long as it exercises live Postgres, Redis, and auth/runtime seams
- Exact mapping of the 8 critical user journeys to existing or newly organized Playwright specs
- Exact helper/module layout for shared test utilities and fixture composition
- Exact request mix, ramp profile, and scenario weighting for k6 so long as the API-heavy focus remains intact

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 15 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `TEST-01` through `TEST-05`, plus the upstream SLA and CI expectations that make these tests meaningful
- `.planning/PROJECT.md` - project-wide quality bar, SLA targets, and the locked expectation that testing is enforced in CI
- `.planning/STATE.md` - current execution state and carry-forward notes

### Prior phase context that constrains Phase 15

- `.planning/phases/12-frontend-next-js-15/12-CONTEXT.md` - frontend auth/session behavior, selective offline policy, module UX boundaries, and route structure that E2E coverage must respect
- `.planning/phases/12-frontend-next-js-15/12-VALIDATION.md` - the existing Vitest and Playwright verification baseline that Phase 15 should consolidate rather than duplicate
- `.planning/phases/13-api-gateway-graphql-webhooks/13-CONTEXT.md` - centralized `/api/v1` contract, REST envelope expectations, and BI GraphQL boundary that integration coverage must verify
- `.planning/phases/14-security-hardening/14-CONTEXT.md` - locked security behavior around session control, tenant access, validation, and rate limiting that tests must continue to enforce
- `.planning/phases/14-security-hardening/14-VALIDATION.md` - the current security regression evidence and live command baseline, including the security integration suites

### Existing test infrastructure and contracts

- `apps/api/package.json` - current API test scripts and raw Node test-runner entrypoints
- `apps/web/package.json` - current web test scripts for Vitest and Playwright
- `apps/api/test/helpers/app-platform.mjs` - current shared API integration helper for standardized platform setup and envelope assertions
- `apps/api/test/helpers/*.mjs` - existing in-memory domain stores and fixture helpers that Phase 15 should standardize
- `apps/api/test/integration/*.test.mjs` - current harness-backed integration suite surface
- `apps/api/test/unit/*.test.mjs` - current backend unit-test surface that informs coverage planning
- `apps/web/tests/e2e/*.spec.ts` - current Playwright suite that should seed the 8 required journeys
- `apps/web/tests/unit/*.test.ts*` - current frontend unit-test surface
- `apps/web/playwright.config.ts` - Playwright runtime assumptions and current environment contract
- `apps/web/vitest.config.ts` - frontend unit-test configuration baseline

### Codebase guidance

- `.planning/codebase/TESTING.md` - existing assessment of harness realism, stale-build risk, and the highest-value testing gaps
- `.planning/codebase/CONVENTIONS.md` - established backend validation and module conventions that tests should align with
- `.planning/codebase/STRUCTURE.md` - repository structure and package boundaries relevant to test ownership

No separate external test strategy ADR exists yet - the references above plus the decisions in this context are the authoritative planning inputs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/api/test/helpers/app-platform.mjs` already centralizes integration-app setup and response-envelope helpers, making it the natural seam for endpoint-matrix expansion.
- `apps/api/test/helpers/*.mjs` already provides domain-specific in-memory stores for finance, AP/AR, HR, payroll, BI, forecasting, notifications, project management, and supply chain.
- `apps/web/tests/e2e/*.spec.ts` already covers strong multi-page flows across auth, finance, HR, payroll, supply chain, BI, projects, offline behavior, and accessibility.
- `apps/web/tests/e2e/helpers.ts` already provides shared browser-test support that can anchor the formal journey layer.

### Established Patterns

- Backend automated tests currently rely on the raw Node test runner, with integration suites primarily using a harness-backed Nest application instead of a live database stack.
- Frontend automated tests currently use Vitest for component/unit checks and Playwright for browser journeys.
- The current repo already mixes broad deterministic harness coverage with narrower higher-fidelity verification in validation workflows; Phase 15 should formalize that split rather than fight it.
- API tests now assume the Phase 13 standardized platform contract, so endpoint coverage must assert the shared envelope and transport behavior consistently.

### Integration Points

- Coverage work will need to span `apps/api` and `apps/web`, but the strictest threshold logic should center on backend service logic first.
- The real-stack smoke layer will need to prove at least the runtime seams the harness cannot: database, cache/session, and auth/runtime integration.
- Formal E2E journey mapping should connect frontend flows from Phase 12 with hardened auth and tenant behavior from Phase 14.
- k6 planning will need clear target endpoints and stable environment assumptions because there is no current load-test wiring in the repo.

</code_context>

<specifics>
## Specific Ideas

- Treat this phase as test-platform consolidation and confidence hardening, not as a rewrite of every existing suite.
- Reuse the strongest existing Playwright specs, but rename or regroup them around business journeys that matter to release confidence.
- Keep the broad endpoint matrix on the fast harness path, then add a much smaller real-stack layer to catch the infrastructure truths the harness misses.
- Make helper cleanup concrete: shared tenant/user creation, cleanup, auth mocking, and domain seed helpers should become obvious reusable entrypoints.
- Aim for load tests that tell the truth about platform behavior under realistic API pressure rather than decorative synthetic scenarios.

</specifics>

<deferred>
## Deferred Ideas

- Replacing the current Node/Vitest/Playwright test stack with a new framework portfolio
- Expanding the real-stack suite until it mirrors the full harness matrix
- Turning Phase 15 into CI/CD pipeline ownership work that belongs to Phase 17
- Treating k6 as a full business-process simulator for every ERP path
- Broad observability, tracing, or production monitoring work that belongs to Phase 18

</deferred>

---

*Phase: 15-testing-strategy*
*Context gathered: 2026-04-25*
