# Phase 17: CI/CD Pipeline - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the repository's GitHub Actions-based delivery pipeline for the already-existing ERP application: PR validation, security gating, image/build verification, automatic promotion to staging, and manually approved promotion to production.

This phase owns pipeline orchestration and release gating around the application tier that Phase 16 already packaged for GitOps deployment. It does not replace ArgoCD with direct cluster deployment from GitHub Actions, provision new cloud infrastructure, or turn staging promotion into a second full product-test program beyond the bounded smoke gate.

</domain>

<decisions>
## Implementation Decisions

### Workflow Shape

- **D-01:** Phase 17 should use separate GitHub Actions workflows for CI and deployment rather than one monolithic workflow.
- **D-02:** PR validation should live in the CI workflow, while environment promotion should live in a distinct deploy workflow triggered from trusted main-branch state.
- **D-03:** Parallelism is welcome inside each workflow where dependencies allow, but the visible pipeline contract should stay split by concern: validation first, promotion second.

### Promotion Model

- **D-04:** Deployment should remain GitOps-first: GitHub Actions builds and publishes artifacts, then updates repo-managed deployment inputs that ArgoCD watches and syncs.
- **D-05:** Main-branch changes should auto-promote to staging after required CI gates pass.
- **D-06:** Production promotion must be manually approved in GitHub and should promote the same staging-proven artifact rather than rebuilding a different one for production.
- **D-07:** GitHub Actions should not become a direct `kubectl` or `helm upgrade` path to the cluster; ArgoCD remains the deployment source of truth.

### Security Gates

- **D-08:** CI must fail on committed-secret findings from `trufflehog`.
- **D-09:** CI must fail on HIGH and CRITICAL vulnerability findings from the chosen image/dependency scanners by default.
- **D-10:** Reviewed exceptions are allowed only through explicit checked-in ignore or allowlist mechanisms so accepted risk is durable, auditable, and not hidden in ad hoc workflow conditionals.
- **D-11:** Security gates belong in the PR/CI path before deployment promotion becomes eligible.

### Staging Smoke Gate

- **D-12:** Production availability should depend on a bounded staging smoke suite, not a full end-to-end rerun of the entire browser matrix.
- **D-13:** The staging smoke gate should cover health, auth/session bootstrap, at least one protected API path, and at least one key web route.
- **D-14:** Smoke coverage should build on the smaller live-runtime seams already introduced in Phase 15 instead of inventing an unrelated release-test framework.

### the agent's Discretion

- Exact workflow trigger design, reusable-workflow split, and job graph, so long as the CI-vs-deploy separation remains clear
- Exact artifact publishing target and immutable tag naming strategy, so long as staging and production promote the same trusted build output
- Exact repo-managed deployment input to update for GitOps promotion, such as Helm values, manifest overlays, or another committed image-reference seam that ArgoCD already watches
- Exact security-scan tool split and ignore-file format, so long as HIGH/CRITICAL findings block by default and reviewed exceptions remain explicit
- Exact shape of the staging smoke implementation, so long as it stays bounded and proves health, auth/session, protected API access, and a key web surface

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and release constraints

- `.planning/ROADMAP.md` - Phase 17 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `CICD-01` through `CICD-04`, plus the upstream testing, security, and deployment constraints the pipeline must enforce
- `.planning/PROJECT.md` - locked stack direction for GitHub Actions, ArgoCD, Kubernetes, zero-hardcoded-secrets expectations, and overall quality bar
- `.planning/STATE.md` - current project execution state and carry-forward notes into Phase 17

### Prior phase context that constrains Phase 17

- `.planning/phases/15-testing-strategy/15-CONTEXT.md` - locked decision to keep broad coverage on the fast suite and add a smaller real-stack smoke layer rather than turning release gating into a full live-stack matrix
- `.planning/phases/16-containerization-kubernetes/16-CONTEXT.md` - locked GitOps shape, Helm overlays, app-of-apps ArgoCD structure, and the explicit expectation that CI/CD extends rather than replaces that layout
- `.planning/phases/13-api-gateway-graphql-webhooks/13-CONTEXT.md` - staging-safe `/api-docs` posture and production restrictions that deployment gating must preserve rather than accidentally expose
- `.planning/phases/14-security-hardening/14-CONTEXT.md` - secrets hygiene, auth/session hardening, and security expectations that CI gates must enforce

### Existing pipeline, validation, and release seams

- `package.json` - root monorepo scripts for `lint`, `typecheck`, `security:secrets`, and Phase 16 verification commands that the CI workflow can orchestrate
- `apps/api/package.json` - backend build, unit, integration, and smoke scripts already available to pipeline jobs
- `apps/web/package.json` - frontend build, typecheck, unit, and Playwright entrypoints already available to pipeline jobs
- `scripts/security/run-trufflehog.ps1` - existing tracked-file secrets scan implementation and current repo-local policy
- `apps/api/test/smoke/auth-runtime.smoke.mjs` - current bounded real-runtime smoke seam for health, login, protected access, and logout/token-revocation behavior
- `apps/web/playwright.config.ts` - current Playwright runtime assumptions, retries, and local-vs-external server behavior
- `apps/web/tests/e2e/auth-live.spec.ts` - lightweight live auth/browser seam that can inform staging smoke design
- `apps/web/tests/e2e/phase15-journeys.spec.ts` - current broader journey suite boundary that should stay distinct from the bounded release smoke gate
- `tests/load/run-k6.ps1` - existing load-test launcher and environment contract, useful for deciding whether any heavier validation remains outside the PR gate

### GitOps deployment surfaces that promotion must drive

- `infra/argocd/README.md` - current app-of-apps deployment model, sync behavior, canary expectations, and rollback model
- `infra/argocd/apps/staging.yaml` - staging ArgoCD application wiring and the repo path currently watched for promotion
- `infra/argocd/apps/prod.yaml` - production ArgoCD application wiring and the prod environment target
- `infra/helm/amdox/values-staging.yaml` - staging runtime hostnames, external-service endpoints, and env overlay seam
- `infra/helm/amdox/values-prod.yaml` - production runtime hostnames, external-service endpoints, and env overlay seam

No existing `.github/workflows` baseline is present in the repository yet, so the files above plus the decisions in this context are the authoritative planning inputs.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `package.json` already centralizes repo-wide `lint`, `typecheck`, `security:secrets`, and Phase 16 verification scripts, giving CI a clear orchestration surface without inventing new commands first.
- `apps/api/package.json` already exposes build, unit, integration, and smoke entrypoints that align well with the roadmap's required CI stages.
- `apps/web/package.json` plus `apps/web/playwright.config.ts` already provide a distinct frontend build/test surface and a browser-test seam that can be reused selectively for release smoke.
- `scripts/security/run-trufflehog.ps1` already gives the repo a concrete secrets-scan baseline and tracked-file filtering policy.
- `apps/api/test/smoke/auth-runtime.smoke.mjs` already encodes a small but meaningful live-runtime verification path for health, auth, protected access, and logout semantics.
- `infra/argocd/apps/staging.yaml`, `infra/argocd/apps/prod.yaml`, and the Helm values overlays already define environment-specific GitOps targets that the deploy workflow can promote through rather than designing a second release mechanism.

### Established Patterns

- The monorepo relies on root-level orchestration plus package-local scripts, so GitHub Actions should call existing scripts where possible instead of embedding large command logic inline.
- Security scanning is already treated as an explicit repository concern rather than an optional local-only habit.
- ArgoCD currently owns sync, self-heal, prune, and environment deployment state, so release automation should feed GitOps inputs and let ArgoCD perform the actual rollout.
- The current live-validation philosophy favors a smaller high-signal smoke seam alongside broader deterministic suites, which matches the chosen bounded staging gate.

### Integration Points

- New `.github/workflows` files will need to orchestrate root scripts, package scripts, and artifact publishing across the monorepo.
- The deploy workflow must update a repo-managed deployment seam that the existing ArgoCD applications already watch for staging and production.
- The staging smoke gate should target the deployed staging URLs and reuse the existing auth/runtime and browser-test seams where possible.
- Security exception handling must live in checked-in files that CI can read consistently across PR and main-branch runs.

</code_context>

<specifics>
## Specific Ideas

- Keep the user-facing pipeline mentally simple: PRs prove code quality and safety, then main promotes through GitOps with manual production approval.
- Treat staging as the truth source for what reaches production: the production release should be the same artifact that already passed staging and smoke.
- Prefer immutable image or artifact references tied to commit identity so promotion is auditable and rollback stays straightforward.
- Make accepted security risk explicit with reviewed, expiring exceptions rather than silently weakening scanners.
- Keep the release smoke gate fast and honest: enough to prove the staged system is alive and accessible, not so broad that promotion becomes a second full CI marathon.

</specifics>

<deferred>
## Deferred Ideas

- Direct cluster deployment from GitHub Actions using `kubectl`, `helm upgrade`, or similar imperative release steps
- Re-running the full Playwright journey matrix as the production promotion gate
- Cloud provisioning, environment bootstrapping, or secret-manager rollout work that belongs to Phase 18
- Broader release analytics, observability, or post-deploy SLO automation that belongs to later observability work

</deferred>

---

_Phase: 17-ci-cd-pipeline_
_Context gathered: 2026-04-27_
