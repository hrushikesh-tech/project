# Codebase Concerns After Phase 3

## Scope
Focused on active correctness, runtime, and workflow risks after Phase 3 (`General Ledger / Finance Core`), with emphasis on places where the repo can appear healthy while still being fragile or partially misconfigured.

## High Risk

### 1. Admin tokens are widened to cross-tenant access
- Evidence:
  - `apps/api/src/auth/strategies/jwt.strategy.ts` forces both `super_admin` and `admin` to `tenantId = '*'`.
  - `apps/api/src/common/guards/tenant.guard.ts` then writes `tenantId || '*'` into CLS.
  - `apps/api/src/finance/finance.service.ts` treats `'*'` as system-wide access and resolves the first tenant or auto-creates one.
- Risk:
  - Any user with the `admin` realm role gets global cross-tenant finance access, not just tenant-local admin access.
  - This is a real authorization bug, not just a convenience shortcut.
- Why it matters:
  - It breaks tenant isolation, which is one of the core invariants established in Phase 2.
  - It can also hide data-model bugs during local testing because requests “work” by bypassing tenant constraints.
- Recommended action:
  - Restrict wildcard access to `super_admin` only.
  - Remove automatic wildcard fallback for normal `admin`.
  - Add integration coverage for tenant-local admin vs super-admin behavior.

### 2. Finance service can auto-provision a tenant during request handling
- Evidence:
  - `apps/api/src/finance/finance.service.ts` in `getResolvedTenantId()` creates `"Amdox System Tenant"` if wildcard resolution finds no tenant.
- Risk:
  - A read or write request can mutate production data shape by creating a tenant implicitly.
  - This makes failures non-obvious and mixes bootstrap behavior into application logic.
- Why it matters:
  - It hides missing setup and can create data that later looks “seeded by the system” without any controlled migration or bootstrap step.
- Recommended action:
  - Remove runtime tenant auto-creation.
  - Fail fast with a setup error if no tenant exists.

## Medium Risk

### 3. Integration tests depend on compiled `dist` output, not source directly
- Evidence:
  - `apps/api/test/integration/finance.api.test.mjs` imports `../../dist/src/...`.
  - `apps/api/test/unit/finance.service.test.mjs` also imports compiled `dist` modules.
- Risk:
  - Tests can fail against stale build output even when source is correct, or pass against stale output when source has changed but was not rebuilt.
  - This already surfaced during Phase 3 debugging when test results diverged from source edits.
- Why it matters:
  - It weakens the value of `test:finance` as a source-of-truth verification step.
- Recommended action:
  - Make test scripts build explicitly before tests, or run tests against source via Nest/TS execution.
  - At minimum, document that `dist` must be rebuilt before finance tests.

### 4. Runtime env naming is inconsistent for API port
- Evidence:
  - `.env.example` documents `PORT_API=3001`.
  - `apps/api/src/main.ts` reads `process.env.API_PORT || 3001`.
- Risk:
  - The documented variable does not control the running API.
  - Local/dev/prod setups can silently bind the wrong port.
- Why it matters:
  - This is a straightforward runtime mismatch that creates avoidable setup confusion.
- Recommended action:
  - Standardize on one variable name and use it everywhere.

### 5. OpenExchangeRates live path is still unverified without credentials
- Evidence:
  - `apps/api/src/finance/fx-rates.service.ts` hard-fails provider fallback when `OPENEXCHANGE_APP_ID` is missing.
  - `.env.example` contains a placeholder value only.
- Risk:
  - Local finance flows that rely on pre-seeded `FxRate` rows can look healthy while live FX fetches still fail in a fresh environment.
- Why it matters:
  - Phase 3’s FX implementation is only partially verified until the external provider path is exercised with a real key.
- Recommended action:
  - Run one explicit live FX test with a valid `OPENEXCHANGE_APP_ID`.
  - If live provider access is optional, document seeded-rate fallback expectations.

### 6. `Account.balance` exists in schema but is not maintained by journal workflows
- Evidence:
  - `packages/db/prisma/schema.prisma` defines `Account.balance BigInt`.
  - Finance service report logic derives balances from `JournalLine` rows instead.
  - No account balance update path was found in `apps/api/src/finance/finance.service.ts`.
- Risk:
  - `Account.balance` can drift permanently from the actual ledger if any code starts reading it later.
- Why it matters:
  - This is a latent correctness bug waiting for later phases to consume the wrong field.
- Recommended action:
  - Either remove `Account.balance` until it is maintained, or update it transactionally when posting/reversing journals.

## Workflow / Repo Hygiene Concerns

### 7. The worktree is heavily polluted with generated artifacts
- Evidence:
  - `git status --short` shows large numbers of changes under:
    - `apps/web/.next/`
    - `.turbo/`
    - `apps/ml-service/__pycache__/`
    - `api.err`
    - `apps/api/scratch/`
  - Root `.gitignore` does not ignore `.next/`, `.turbo/`, `__pycache__/`, or scratch output.
- Risk:
  - Real source changes are harder to review.
  - Build output can be mistaken for implementation work.
  - Repo-wide verification can become nondeterministic.
- Why it matters:
  - “Everything works” is less credible when the repo state includes a large volume of generated files.
- Recommended action:
  - Expand `.gitignore` for monorepo-generated artifacts.
  - Keep `scratch/` and ad hoc UAT scripts out of tracked source unless intentionally curated.

### 8. Phase/state tracking is inconsistent with code reality
- Evidence:
  - The repo contains active Phase 3 code and tests, but `.planning` artifacts and dirty worktree state show incomplete planning hygiene and mixed status artifacts from prior phases.
- Risk:
  - Planning metadata can mislead future execution commands or audits about what is actually complete.
- Recommended action:
  - Reconcile `.planning/STATE.md`, roadmap completion markers, and Phase 3 summary/UAT artifacts after code sign-off.

## Lower Risk / Noise

### 9. Debug logging is left in authentication and finance paths
- Evidence:
  - `TRACE:` logs are present in:
    - `apps/api/src/auth/strategies/jwt.strategy.ts`
    - `apps/api/src/finance/finance.service.ts`
    - `apps/api/scratch/uat-phase3-finance.ts`
- Risk:
  - Request/auth internals and tenant resolution details leak into logs.
- Recommended action:
  - Remove ad hoc `console.log` / `console.error` statements or replace them with structured debug logging behind environment controls.

## Current Bottom Line

Phase 3 finance functionality is implemented and test-covered, but the codebase is not yet “fully clean” in the operational sense. The main issues that can still invalidate confidence are:
- tenant-scope escalation for `admin`
- runtime tenant auto-creation
- brittle `dist`-dependent test setup
- missing live FX credential verification
- generated artifact pollution in the worktree

Those should be treated as the active follow-up list before claiming the entire repo state is robust.
