---
phase: 17-ci-cd-pipeline
plan: 03
subsystem: infra
tags: [github-actions, deploy, gitops, argocd, ghcr]
requires:
  - phase: 17-ci-cd-pipeline
    provides: CI workflow, tag helper, and explicit image repositories from Plans 01-02
provides:
  - trusted deploy workflow triggered from successful main CI
  - immutable artifact metadata carried from build to staging and production
  - GitOps write-back promotion for staging and production values
affects: [17-04, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      workflow_run trusted deploys,
      git-backed promotion commits,
      environment-gated production releases,
    ]
key-files:
  created: [.github/workflows/deploy.yml]
  modified:
    [
      infra/argocd/README.md,
      infra/helm/amdox/values-staging.yaml,
      infra/helm/amdox/values-prod.yaml,
    ]
key-decisions:
  - "Used the CI workflow_run path instead of direct push deployment so only trusted main validation can promote."
  - "Kept apiWorker on the same immutable API image repository and tag family because the Helm chart already models it as the same runtime artifact."
patterns-established:
  - "Environment promotion is a git commit against watched values files, not a direct cluster mutation."
requirements-completed: [CICD-01, CICD-04]
duration: single-session
completed: 2026-04-27
---

# Phase 17-03: Trusted GitOps Promotion Workflow Summary

**A separate deploy workflow now reacts only to successful main-branch CI, builds immutable GHCR artifacts, and promotes staging and production through Git-backed Helm values updates**

## Performance

- **Duration:** single-session
- **Started:** 2026-04-27T12:55:00+05:30
- **Completed:** 2026-04-27T14:03:34+05:30
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- Added `.github/workflows/deploy.yml` with `workflow_run`, least-needed write/package permissions, and deploy concurrency.
- Published one immutable tag family across `web`, `api`, `apiWorker`, and `mlService` metadata, with `apiWorker` explicitly reusing the API image artifact.
- Implemented staging and production promotion as narrow bot-authored values-file commits instead of direct `kubectl` or `helm` commands.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `.github/workflows/deploy.yml` - trusted artifact publish and GitOps promotion workflow.
- `infra/argocd/README.md` - operator-facing promotion and rollback flow aligned with the workflow.
- `infra/helm/amdox/values-staging.yaml` - watched staging tag pins for GitOps promotion.
- `infra/helm/amdox/values-prod.yaml` - watched production tag pins for GitOps promotion.

## Decisions Made

- Used path-ignore in CI plus `[skip ci]` promotion commit messages to avoid recursive CI/deploy loops.
- Put the staging readiness wait in the deploy workflow before live smoke so ArgoCD has a real reconciliation window.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None in the workflow contract itself. The deploy path is still externally gated by real GitHub permissions, staging endpoints, and environment approval configuration.

## User Setup Required

- Configure the GitHub `production` environment with required reviewers before using the production job as a real gate.
- Ensure the repo’s `GITHUB_TOKEN` or equivalent workflow token has the package and contents scopes expected by the deploy job.

## Next Phase Readiness

- Phase 17-04 can wire staging smoke directly behind the staging promotion job and ahead of the production environment gate.
- Operators now have a consistent GitOps promotion path to follow in both workflow YAML and README form.

---

_Phase: 17-ci-cd-pipeline_
_Completed: 2026-04-27_
