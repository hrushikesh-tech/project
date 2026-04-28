---
phase: 17-ci-cd-pipeline
plan: 01
subsystem: infra
tags: [github-actions, gitops, helm, ghcr, security]
requires:
  - phase: 16-containerization-kubernetes
    provides: Helm overlays, ArgoCD app wiring, and container image contracts
provides:
  - immutable staging and production tag seams in Helm overlays
  - deterministic repo-local tag update helper
  - checked-in Snyk and Trivy exception policy files
  - root Phase 17 verification entrypoints
affects: [17-02, 17-03, 17-04, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      checked-in GitOps promotion helper,
      explicit environment tag overlays,
      reviewed security exception files,
    ]
key-files:
  created: [scripts/release/update-image-tags.mjs, .snyk, .trivyignore.yaml]
  modified:
    [
      package.json,
      infra/helm/amdox/values.yaml,
      infra/helm/amdox/values-staging.yaml,
      infra/helm/amdox/values-prod.yaml,
      .planning/phases/17-ci-cd-pipeline/17-VALIDATION.md,
    ]
key-decisions:
  - "Aligned the shared image repositories with GHCR so the deploy workflow can publish the same repositories Helm already references."
  - "Kept the staging and production overlays structurally identical so one helper can update both deterministically."
patterns-established:
  - "Promotion metadata lives in git-tracked Helm values, not workflow-local YAML surgery."
requirements-completed: [CICD-01, CICD-02, CICD-03]
duration: single-session
completed: 2026-04-27
---

# Phase 17-01: Release Contract Foundation Summary

**Helm overlays now carry explicit environment tag pins, and one checked-in helper updates those tags consistently for GitOps promotion**

## Performance

- **Duration:** single-session
- **Started:** 2026-04-27T12:55:00+05:30
- **Completed:** 2026-04-27T14:03:34+05:30
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Added explicit staging and production tag override blocks for `web`, `api`, `apiWorker`, and `mlService`.
- Created `scripts/release/update-image-tags.mjs` with dry-run support and hard failure on missing image tag paths.
- Added checked-in `.snyk` and `.trivyignore.yaml` contracts plus repo-root Phase 17 verification scripts.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `scripts/release/update-image-tags.mjs` - deterministic tag rewrite helper for staging and production overlays.
- `infra/helm/amdox/values.yaml` - shared GHCR repository locations for deployable services.
- `infra/helm/amdox/values-staging.yaml` - explicit staging image tag overrides for all promoted runtimes.
- `infra/helm/amdox/values-prod.yaml` - explicit production image tag overrides for all promoted runtimes.
- `package.json` - repo-root foundation, security, and smoke verification entrypoints.
- `.snyk` - checked-in reviewed-exception policy file for Snyk.
- `.trivyignore.yaml` - checked-in reviewed-exception policy file for Trivy.

## Decisions Made

- Used GHCR image repositories rooted at the current repo owner so the workflow and Helm chart agree on artifact names.
- Kept the exception policy files empty but structured, so future reviewed ignores stay explicit in git.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None in the foundation contract itself. The dry-run helper succeeded against both staging and production overlays.

## User Setup Required

None - no external service configuration required for the foundation artifacts themselves.

## Next Phase Readiness

- Phase 17-02 can consume the repo-root commands, security policy files, and deterministic tag helper immediately.
- Phase 17-03 can update staging and production values without inventing workflow-local mutation logic.

---

_Phase: 17-ci-cd-pipeline_
_Completed: 2026-04-27_
