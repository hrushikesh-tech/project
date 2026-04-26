# Phase 17: CI/CD Pipeline - Research

**Date:** 2026-04-27
**Phase:** 17-ci-cd-pipeline
**Status:** Complete

## What This Phase Needs To Solve

Phase 17 has to turn the repo's existing application, test, and GitOps seams into a trustworthy GitHub Actions delivery pipeline without changing the deployment ownership decisions already locked in Phase 16. That means:

- proving PR-quality gates for lint, typecheck, unit, integration, security, E2E, and build
- reusing the existing repository-local secrets scan instead of inventing a second secret-check path
- adding explicit vulnerability gates for dependency and image risk with checked-in exceptions
- publishing immutable application artifacts that staging and production can both consume
- promoting through the existing Helm-values-plus-ArgoCD model rather than calling the cluster directly
- blocking production until a bounded live staging smoke proves health, auth, protected API access, and a key web route

The biggest design tension is that the repo already has strong local verification seams and GitOps deployment files, but it does not yet have a release-artifact contract, environment-promotion workflow, or any guard against recursive self-triggered workflow commits when deploy automation writes staging and production tag changes back into the repo.

## Codebase Findings

### Existing assets that Phase 17 should reuse

- `package.json` already exposes root orchestration entrypoints for:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm security:secrets`
  - Phase 16 verification commands
- `apps/api/package.json` already exposes:
  - `build`
  - `test:unit`
  - `test:integration`
  - `test:smoke`
- `apps/web/package.json` already exposes:
  - `build`
  - `typecheck`
  - `test:unit`
  - `test:e2e`
- `scripts/security/run-trufflehog.ps1` already gives the repo a tracked-file secrets-scan policy with include and exclude filters plus a clear failure contract.
- `apps/api/test/smoke/auth-runtime.smoke.mjs` already proves a bounded API smoke path for:
  - `/api/v1/health`
  - login
  - one protected API call
  - logout and revoked-token enforcement
- `apps/web/tests/e2e/auth-live.spec.ts` already proves a minimal live browser-auth seam that can be adapted for staging release smoke.
- `apps/web/playwright.config.ts` already supports external-server execution through:
  - `PLAYWRIGHT_BASE_URL`
  - `PLAYWRIGHT_EXTERNAL_SERVER=1`
- `infra/argocd/apps/staging.yaml` and `infra/argocd/apps/prod.yaml` already point ArgoCD at the shared Helm chart with environment-specific value overlays.
- `infra/helm/amdox/values.yaml` already defines per-service image repositories and tags for:
  - `web`
  - `api`
  - `apiWorker`
  - `mlService`

### Important constraints and gaps

- There is currently no `.github/workflows` directory or GitHub Actions baseline in the repo.
- The Helm values contract still defaults to mutable tags such as `latest` and `canary`, while the user explicitly wants the same staging-proven artifact promoted to production.
- The environment overlays (`values-staging.yaml`, `values-prod.yaml`) do not yet carry explicit per-service image tag overrides, so there is no durable GitOps promotion seam for immutable release tags.
- There is no checked-in ignore or exception policy yet for:
  - Snyk
  - Trivy
- The current local smoke script targets a locally spawned API process, not a deployed staging environment.
- The current live Playwright auth spec proves browser login, but it does not yet assert one named protected release route or act as the production-availability gate.
- A deploy workflow that writes values updates back to `main` will re-trigger CI unless the plan deliberately adds loop prevention such as:
  - bot-commit guards
  - `[skip ci]` or equivalent commit-message strategy
  - path or actor filters
- The repo has no current registry contract. A release workflow will need:
  - a default OCI target
  - image naming rules
  - credentials and package permissions
- Production approval in GitHub is not configured yet, so Phase 17 needs a plan that uses GitHub Environments rather than inventing a custom approval mechanism in YAML alone.

## Recommended Technical Direction

### 1. Split CI and deployment into separate workflows

The user's locked preference is the right fit for this repo:

- `ci.yml` handles PR and `main` validation
- `deploy.yml` handles trusted promotion only

The cleanest trigger contract is:

- `ci.yml` on `pull_request` and `push` to `main`
- `deploy.yml` on `workflow_run` for successful `ci.yml` runs on `main`

That separation keeps PR signal clean, avoids exposing deploy permissions to untrusted PR contexts, and matches the user's "validation first, promotion second" decision.

### 2. Keep PR CI deterministic and repo-local

The PR workflow should use deterministic repo-local checks, not live environment checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web run test:e2e`
- `pnpm build`
- `pnpm security:secrets`

The bounded live staging smoke belongs in deploy-time promotion, not the PR path.

### 3. Promote immutable image tags through Helm values overlays

The most compatible GitOps promotion seam is:

- build and publish immutable tags keyed to the trusted commit SHA
- write those tags into `infra/helm/amdox/values-staging.yaml`
- let ArgoCD sync staging
- after smoke and manual approval, write the exact same tags into `infra/helm/amdox/values-prod.yaml`

This matches all locked decisions:

- ArgoCD stays the deploy owner
- staging and production consume the same artifact
- production approval happens before the prod values update
- promotion remains auditable in git history

### 4. Use GitHub Environments for staging and production policy

The deploy workflow should use GitHub Environments instead of hand-rolled YAML pauses:

- `staging` environment for deployment secrets and URL inputs
- `production` environment with required reviewers for manual approval

That directly satisfies `CICD-04` and makes the approval policy visible in GitHub rather than hidden inside action logic.

### 5. Reuse trufflehog, add Snyk and Trivy with explicit checked-in exception files

Security gating should be split by responsibility:

- `trufflehog` reuses `scripts/security/run-trufflehog.ps1`
- `snyk` covers dependency or code vulnerability policy
- `trivy` covers repository or image vulnerability policy

Because the user explicitly wants reviewed exceptions, the plan should include checked-in files such as:

- `.snyk`
- `.trivyignore.yaml`

Those exception files should carry owner, reason, and expiry notes so accepted risk stays reviewable instead of becoming silent workflow drift.

### 6. Treat staging smoke as a separate live gate, not a second full CI run

The bounded staging smoke should prove exactly the locked release checks:

- health endpoint responds
- real auth or session bootstrap succeeds
- one protected API path succeeds
- one key protected web route renders after login

The cleanest implementation is:

- adapt the existing API smoke seam for an externally hosted base URL
- add one dedicated live Playwright release smoke spec
- wire both into `deploy.yml` after the staging promotion commit and rollout wait
- only expose the production approval step after smoke passes

### 7. Prevent recursive workflow loops from GitOps promotion commits

Because deploy automation will commit updated values files back to the repo, the plan must include loop prevention. The safest options are:

- tag promotion commits with a skip token and teach `ci.yml` to ignore them
- guard `deploy.yml` and `ci.yml` by actor and branch intent
- keep values-only promotion commits narrow and machine-authored

The planner should not leave this implicit. If it does, Phase 17 risks an infinite deploy or validation loop.

### 8. Add root phase-17 verification scripts for truthful operator use

Phase 17 will be easier to validate and maintain if it introduces explicit root scripts for:

- CI command aggregation
- security aggregation
- smoke execution
- GitOps tag-update dry runs

That keeps workflow YAML thinner and gives operators a local reproduction path when CI fails.

## Repo Seams To Honor

### Application verification seams

- `apps/api/package.json` is the authoritative backend build and test contract.
- `apps/web/package.json` is the authoritative frontend build and test contract.
- `apps/api/test/smoke/auth-runtime.smoke.mjs` is the starting point for the API-side staging smoke.
- `apps/web/tests/e2e/auth-live.spec.ts` plus `apps/web/tests/e2e/helpers.ts` are the starting point for the browser-side staging smoke.

### GitOps deployment seams

- `infra/argocd/apps/staging.yaml` and `infra/argocd/apps/prod.yaml` already encode the environment split and must remain the source watched by ArgoCD.
- `infra/helm/amdox/values-staging.yaml` and `infra/helm/amdox/values-prod.yaml` are the most honest promotion inputs for environment-specific image tags.
- `infra/helm/amdox/values.yaml` already defines repository and tag fields, so Phase 17 should extend that structure rather than invent a separate release manifest format.

### Security and release hygiene seams

- `scripts/security/run-trufflehog.ps1` should remain the canonical secrets scan implementation.
- `.env.example` and the existing auth test env names imply CI and staging smoke will need secrets for:
  - auth credentials
  - Snyk token
  - registry login
  - any bot token used for repo write-back

## Common Pitfalls The Planner Should Avoid

### 1. Rebuilding different artifacts for staging and production

That would directly violate the user's locked decision that production should promote the same staging-proven artifact.

### 2. Updating the cluster directly from GitHub Actions

That would contradict the GitOps-first deployment model already locked in Phase 16 and Phase 17 context.

### 3. Leaving values overlays on mutable `latest` tags

If staging and prod continue to resolve mutable tags, the repo cannot truthfully claim what exact artifact is deployed.

### 4. Letting promotion commits trigger the full pipeline recursively

Without skip or actor guards, the workflow will create self-triggered loops and unstable release behavior.

### 5. Hiding security exceptions in workflow conditionals

The user explicitly chose reviewed, checked-in exceptions. Workflow-local bypass logic would violate that preference and make risk review harder.

### 6. Using the full browser journey suite as the prod gate

The user explicitly rejected that. Live promotion should use the smaller bounded smoke gate, not the whole E2E matrix again.

### 7. Treating live auth smoke as optional for staging promotion

The chosen bounded smoke requires real auth or session bootstrap. Health-only checks are not enough for this phase.

## Validation Architecture

Phase 17 should validate across four layers:

- deterministic PR checks against repo-local build and test seams
- security gates for secrets, dependency risk, and image or filesystem risk
- GitOps promotion correctness through values-update dry runs and workflow contract checks
- live staging smoke before production approval becomes available

Recommended command set during execution:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web run test:e2e`
- `pnpm build`
- `pnpm security:secrets`
- `snyk test --severity-threshold=high`
- `trivy fs --exit-code 1 --severity HIGH,CRITICAL .`
- `node scripts/release/update-image-tags.mjs --file infra/helm/amdox/values-staging.yaml --set-tag test-sha --dry-run`
- `node scripts/release/update-image-tags.mjs --file infra/helm/amdox/values-prod.yaml --set-tag test-sha --dry-run`
- `PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=https://web.staging.amdox.example pnpm --filter @amdox/web run test:e2e -- --grep "@staging-release"`
- `PHASE15_SMOKE_BASE_URL=https://api.staging.amdox.example pnpm --filter @amdox/api run test:smoke`
- `rg "workflow_run|environment: production|trivy|snyk|trufflehog|packages: write|contents: write" .github/workflows`

Manual-only or environment-gated verification should remain for:

- confirming GitHub Environment reviewers really gate the `production` environment
- proving the repo write-back token can commit and push promotion commits in the target repo
- validating that ArgoCD in the real cluster picks up the staging and production values updates
- confirming staging auth credentials and protected-route fixtures exist in the target environment

## Planning Implication

The cleanest plan split for Phase 17 is:

1. release-contract foundation: immutable image-tag helpers, values-overlay seam, checked-in security exception policy, and truthful verification commands
2. PR CI workflow: deterministic repo-local validation plus secrets, Snyk, and Trivy gates
3. deploy workflow: trusted `main` build and publish, staging GitOps promotion, and production environment approval with same-artifact promotion
4. live staging smoke and closeout: bounded API plus browser smoke, deploy-gate wiring, and operator-facing rollback or reproduction notes

That ordering establishes the release contract first, builds PR confidence second, handles trusted promotion third, and closes with the user-selected live smoke gate plus release-operability notes.
