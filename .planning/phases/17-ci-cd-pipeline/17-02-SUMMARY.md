---
phase: 17-ci-cd-pipeline
plan: 02
subsystem: testing
tags: [github-actions, ci, playwright, snyk, trivy, trufflehog]
requires:
  - phase: 17-ci-cd-pipeline
    provides: root verification commands, helper scripts, and checked-in policy files from Plan 01
provides:
  - PR and main CI workflow with least-privilege defaults
  - deterministic local Playwright auth baseline for E2E
  - ML lint command aligned with repo-local Python tooling
affects: [17-03, 17-04, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      repo-local ci entrypoints,
      build-time auth secret wrapper,
      python-backed ml lint contract,
    ]
key-files:
  created: [.github/workflows/ci.yml, apps/web/scripts/with-auth-secret.mjs]
  modified:
    [
      package.json,
      apps/ml-service/package.json,
      apps/web/package.json,
      apps/web/playwright.config.ts,
    ]
key-decisions:
  - "Kept CI split from deploy and used path-ignore plus [skip ci] semantics to avoid promotion loops."
  - "Fixed local E2E and web build determinism by injecting fallback auth secrets only for test/build surfaces, not deployed runtime startup."
patterns-established:
  - "CI jobs should consume checked-in commands and thin wrappers instead of embedding hidden environment hacks."
requirements-completed: [CICD-01, CICD-02, CICD-03]
duration: single-session
completed: 2026-04-27
---

# Phase 17-02: PR CI Workflow And Security Gates Summary

**The repo now has a dedicated CI workflow with real lint, typecheck, test, security, and build stages, plus deterministic local auth baselines for Playwright and Next.js build**

## Performance

- **Duration:** single-session
- **Started:** 2026-04-27T12:55:00+05:30
- **Completed:** 2026-04-27T14:03:34+05:30
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Added `.github/workflows/ci.yml` for `pull_request` and `push` to `main` with minimal permissions and concurrency cancellation.
- Kept CI grounded in repo commands while making the ML lint path use the existing repo-local Python launcher.
- Fixed the local web E2E and web build contracts so they no longer depend on an externally pre-set `AUTH_SECRET`.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `.github/workflows/ci.yml` - CI workflow covering lint, typecheck, API tests, web tests, security, and build.
- `apps/ml-service/package.json` - lint now reuses the repo-local Python launcher instead of assuming `ruff` is globally installed.
- `apps/web/playwright.config.ts` - local Playwright web server gets a deterministic fallback auth secret.
- `apps/web/scripts/with-auth-secret.mjs` - build-only wrapper that injects a fallback auth secret for `next build`.
- `apps/web/package.json` - web build now runs through the build-time auth wrapper.

## Decisions Made

- Installed Python requirements in the CI lint job because `pnpm lint` already includes the ML service and therefore genuinely depends on `ruff`.
- Left the security workflow on real Snyk and Trivy tools instead of weakening those jobs into advisory-only placeholders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking] Local web E2E needed a deterministic auth secret**

- **Found during:** Task 4 (local CI verification)
- **Issue:** Playwright's local web server booted without `AUTH_SECRET`, so the protected-shell redirect test never saw a healthy auth runtime.
- **Fix:** Added a Playwright-only fallback auth secret in the local `webServer` env.
- **Files modified:** `apps/web/playwright.config.ts`
- **Verification:** `pnpm --filter @amdox/web run test:e2e` passed outside the sandbox after the fix.

**2. [Blocking] Next.js build needed a build-time auth secret**

- **Found during:** Task 4 (local CI verification)
- **Issue:** `next build` failed while collecting route data for `/api/auth/[...nextauth]` when `AUTH_SECRET` was unset.
- **Fix:** Added `apps/web/scripts/with-auth-secret.mjs` and routed the web build through it so only build-time compilation gets a deterministic fallback.
- **Files modified:** `apps/web/package.json`, `apps/web/scripts/with-auth-secret.mjs`
- **Verification:** `pnpm --filter @amdox/web run build` and the full `pnpm build` both passed outside the sandbox after the fix.

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to keep the CI contract truthful and locally reproducible.

## Issues Encountered

- `pnpm lint` still fails because `packages/db` contains pre-existing `@typescript-eslint/no-explicit-any` errors in the tenant and soft-delete extensions.
- `pnpm security:secrets` runs but currently reports trufflehog scan errors on 11 files in this local Windows environment.
- `snyk` and `trivy` are not installed locally, so those commands remain workflow-only until the tools are available here.

## User Setup Required

- Configure the GitHub `SNYK_TOKEN` secret before expecting the blocking Snyk gate to pass in Actions.

## Next Phase Readiness

- Phase 17-03 can trust the CI/deploy workflow split and the repo-local build/test commands.
- The remaining local blockers are repo-wide lint debt and scanner availability, not missing Phase 17 CI wiring.

---

_Phase: 17-ci-cd-pipeline_
_Completed: 2026-04-27_
