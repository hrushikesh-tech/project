---
phase: 17-ci-cd-pipeline
verified: 2026-04-27T16:02:00+05:30
status: passed
score: 4/4 must-haves verified
---

# Phase 17: CI/CD Pipeline Verification Report

**Phase Goal:** Implement split CI and deploy workflows, GitOps tag promotion through ArgoCD-watched Helm values, hard security gates with checked-in exception files, and a bounded staging smoke gate before production approval.
**Verified:** 2026-04-27T16:02:00+05:30
**Status:** passed

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                    | Status   | Evidence                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Environment-specific Helm values can pin immutable tags and are updated by one deterministic helper      | VERIFIED | `values-staging.yaml` and `values-prod.yaml` now each carry explicit tag blocks for `web`, `api`, `apiWorker`, and `mlService`, and the helper dry-run succeeded for both files. |
| 2   | A dedicated CI workflow validates PRs and `main` without deploy privileges                               | VERIFIED | `.github/workflows/ci.yml` now owns lint, typecheck, API tests, web tests, security gates, and build under read-only permissions.                                                |
| 3   | A separate trusted deploy workflow promotes through GitOps values commits and manual production approval | VERIFIED | `.github/workflows/deploy.yml` uses `workflow_run`, `contents: write`, `packages: write`, staging values commits, staging smoke, and `environment: production`.                  |
| 4   | Production remains downstream of bounded staging smoke instead of artifact publication alone             | VERIFIED | The deploy workflow runs the new API and Playwright staging smoke commands before the production job can start, and the README documents the same sequence and rollback path.    |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                        | Expected                             | Status               | Details                                                                                                        |
| ----------------------------------------------- | ------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                      | PR and `main` validation workflow    | EXISTS + SUBSTANTIVE | Contains `pull_request`, `push`, concurrency, least-privilege permissions, and blocking security/build stages. |
| `.github/workflows/deploy.yml`                  | trusted GitOps promotion workflow    | EXISTS + SUBSTANTIVE | Contains `workflow_run`, `contents: write`, `packages: write`, staging smoke, and `environment: production`.   |
| `scripts/release/update-image-tags.mjs`         | deterministic values update helper   | EXISTS + SUBSTANTIVE | Supports `--file`, shared or per-service tags, dry-run mode, and missing-path failure.                         |
| `.snyk`                                         | checked-in reviewed exception policy | EXISTS + SUBSTANTIVE | Present and wired into the CI security job.                                                                    |
| `.trivyignore.yaml`                             | checked-in reviewed exception policy | EXISTS + SUBSTANTIVE | Present and wired into the CI security job.                                                                    |
| `apps/api/test/smoke/staging-release.smoke.mjs` | bounded API staging smoke            | EXISTS + SUBSTANTIVE | Verifies health, login, protected access, logout, and revoked-token behavior against an external base URL.     |
| `apps/web/tests/e2e/staging-release.spec.ts`    | bounded browser staging smoke        | EXISTS + SUBSTANTIVE | Reuses the shared login helper and proves one protected finance route.                                         |

**Artifacts:** 7/7 verified

### Key Link Verification

| From                           | To                                              | Via                                    | Status | Details                                                                                                                             |
| ------------------------------ | ----------------------------------------------- | -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                 | `scripts/release/update-image-tags.mjs`         | root verification and dry-run commands | WIRED  | Root scripts call the same helper the deploy workflow uses.                                                                         |
| `.github/workflows/ci.yml`     | `apps/ml-service/package.json`                  | repo-local lint command contract       | WIRED  | The CI lint job installs Python requirements because the ML package lint path now truthfully reuses the repo-local Python launcher. |
| `.github/workflows/deploy.yml` | `infra/helm/amdox/values-staging.yaml`          | GitOps staging promotion               | WIRED  | Staging promotion is a values-file commit, not a direct cluster mutation.                                                           |
| `.github/workflows/deploy.yml` | `apps/api/test/smoke/staging-release.smoke.mjs` | bounded API release gate               | WIRED  | The staging smoke job runs the new API release smoke before production can start.                                                   |
| `.github/workflows/deploy.yml` | `apps/web/tests/e2e/staging-release.spec.ts`    | bounded browser release gate           | WIRED  | The staging smoke job runs the tagged browser smoke before `environment: production`.                                               |
| `infra/argocd/README.md`       | `.github/workflows/deploy.yml`                  | operator release and rollback flow     | WIRED  | The README now describes the same staging promotion, smoke, approval, and rollback path implemented in YAML.                        |

**Wiring:** 6/6 connections verified

## Requirements Coverage

| Requirement                                                                          | Status    | Blocking Issue                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CICD-01`: GitHub Actions CI/CD pipeline - build, test, dockerize, deploy to cluster | SATISFIED | Workflow split, artifact publish, GitOps values promotion, and smoke gating are all implemented.                                                                                                         |
| `CICD-02`: Secrets scanning with trufflehog in CI                                    | SATISFIED | The CI workflow reuses the checked-in PowerShell script, and the local Windows verification path is now green through a Docker-backed Trufflehog scan of the active repo paths.                          |
| `CICD-03`: SAST/dependency/image scan with Snyk or Trivy                             | SATISFIED | The CI security job includes blocking Snyk and Trivy steps wired to checked-in policy files. Local Trivy verification is green; local Snyk verification is blocked only by missing shell authentication. |
| `CICD-04`: GitHub Environment approval before production deploy                      | SATISFIED | The deploy workflow includes `environment: production` only after staging promotion and bounded smoke.                                                                                                   |

**Coverage:** 4/4 requirements satisfied

## Anti-Patterns Found

No active anti-patterns remain inside the Phase 17 implementation itself. The remaining blockers are external credentials and live-environment verification, not code-shape issues.

## Human Verification Required

The implementation is complete, but these environment-backed checks still require real infrastructure or credentials:

- GitHub `production` environment reviewers
- `SNYK_TOKEN` and staging smoke credentials in Actions
- live ArgoCD reconciliation after values commits
- real staging host availability for the smoke jobs

## Gaps Summary

**No implementation gaps found.** Remaining friction is now limited to Snyk authentication plus external GitHub/cluster validation rather than missing workflow/file contracts or repo-local lint/security setup.

## Verification Metadata

**Verification approach:** Goal-backward from the Phase 17 roadmap goal and success criteria
**Must-haves source:** Plan 17-01 through 17-04 frontmatter plus locked discuss-phase decisions
**Automated checks:** 10 passed, 3 blocked by credentials or external environment
**Human checks required:** 4 environment-backed confirmations
**Total verification time:** single-session

---

_Verified: 2026-04-27T16:02:00+05:30_
_Verifier: the agent_
