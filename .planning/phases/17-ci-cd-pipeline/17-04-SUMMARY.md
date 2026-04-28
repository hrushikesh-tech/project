---
phase: 17-ci-cd-pipeline
plan: 04
subsystem: testing
tags: [staging-smoke, playwright, api-smoke, argocd, release]
requires:
  - phase: 17-ci-cd-pipeline
    provides: deploy workflow and GitOps promotion path from Plans 02-03
provides:
  - bounded external API smoke for staging
  - bounded browser release smoke for one protected route
  - deploy workflow gate that blocks production until staging smoke passes
affects: [18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      external-server playwright smoke,
      release-focused API auth smoke,
      git-backed rollback runbook,
    ]
key-files:
  created:
    [
      apps/api/test/smoke/staging-release.smoke.mjs,
      apps/web/tests/e2e/staging-release.spec.ts,
    ]
  modified:
    [
      apps/web/tests/e2e/helpers.ts,
      package.json,
      .github/workflows/deploy.yml,
      infra/argocd/README.md,
      .planning/phases/17-ci-cd-pipeline/17-VALIDATION.md,
    ]
key-decisions:
  - "Kept the live smoke intentionally bounded to health, auth, one protected API path, and one protected finance route."
  - "Reused the existing Playwright login helper rather than creating a second staging-only auth path."
patterns-established:
  - "Production approval stays downstream of live staging evidence, not just artifact publication."
requirements-completed: [CICD-01, CICD-04]
duration: single-session
completed: 2026-04-27
---

# Phase 17-04: Bounded Staging Smoke And Release Closeout Summary

**The deploy workflow now blocks production behind a bounded staging smoke that proves health, auth, protected API access, and one protected finance route before production values can be updated**

## Performance

- **Duration:** single-session
- **Started:** 2026-04-27T12:55:00+05:30
- **Completed:** 2026-04-27T14:03:34+05:30
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- Added `apps/api/test/smoke/staging-release.smoke.mjs` for external health/login/protected-route/logout verification.
- Added `apps/web/tests/e2e/staging-release.spec.ts` tagged for staging release use and backed by the existing login helper.
- Wired both smoke commands into the deploy workflow so `environment: production` only appears after staging smoke succeeds.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `apps/api/test/smoke/staging-release.smoke.mjs` - bounded API release smoke against a deployed staging base URL.
- `apps/web/tests/e2e/staging-release.spec.ts` - bounded browser smoke for one protected finance route.
- `apps/web/tests/e2e/helpers.ts` - shared live auth helper now accepts Phase 17 credential env vars.
- `.github/workflows/deploy.yml` - staging smoke jobs now gate the production job.
- `infra/argocd/README.md` - release and rollback flow now documents the same GitOps staging gate the workflow enforces.

## Decisions Made

- Reused Phase 15 env variable names where possible so the API smoke could stay close to the existing auth-runtime semantics.
- Kept the smoke commands repo-root-addressable through `package.json` instead of hiding them inside workflow-only shell snippets.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Live staging smoke was not run locally because the required staging URLs and credentials are environment-gated inputs, not repo-local fixtures.

## User Setup Required

- Provide `PHASE17_AUTH_USERNAME` and `PHASE17_AUTH_PASSWORD` in GitHub Actions secrets for the staging smoke job.
- Provide a valid tenant identifier if staging auth requires something other than the default `tenant-1`.

## Next Phase Readiness

- Phase 17 now closes with bounded live-gate commands and operator rollback guidance instead of just workflow YAML.
- Phase 18 can build observability and operational documentation on top of a concrete CI/CD and release-gate path.

---

_Phase: 17-ci-cd-pipeline_
_Completed: 2026-04-27_
