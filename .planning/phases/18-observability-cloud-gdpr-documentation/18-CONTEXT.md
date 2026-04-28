# Phase 18: Observability, Cloud, GDPR & Documentation - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument the ERP platform with production-grade application observability, provision the AWS deployment foundation and required platform glue via Terraform, implement GDPR data-subject-rights and retention behavior that fits a finance-heavy ERP, and publish the core platform documentation set.

This phase extends the already-established application, Helm, and GitOps foundation from Phases 16 and 17. It does not replace ArgoCD with a different deployment model, turn Terraform into a full environment-bootstrap monolith, or weaken the previously locked security and audit constraints in order to satisfy privacy workflows.

</domain>

<decisions>
## Implementation Decisions

### Observability Scope

- **D-01:** Phase 18 should use a hybrid observability model.
- **D-02:** Application telemetry is the hard requirement: `api`, `api-worker`, `ml-service`, and key business/runtime flows must be instrumented with traces and metrics.
- **D-03:** Platform observability should stay intentionally thin: include a small set of golden-signal views for infrastructure health rather than attempting a full platform-observability buildout in this phase.
- **D-04:** Grafana dashboards and Prometheus alerts should prioritize actionable signals for application performance, business metrics, and a minimal infrastructure-health layer.

### Cloud Infrastructure Boundary

- **D-05:** Terraform should own AWS foundation resources for the current deployment model: EKS, Aurora, ElastiCache, S3, WAF, and the networking/security primitives they depend on.
- **D-06:** Terraform should also own the platform glue that makes the environment usable, including IAM/service-account wiring, storage policies/lifecycle, and environment-level integrations needed by the existing Helm and ArgoCD shape.
- **D-07:** Phase 18 should not expand into a near-complete environment bootstrap that absorbs responsibilities better left with Helm, ArgoCD, or later platform work.

### GDPR Operating Model

- **D-08:** GDPR behavior should be audit-first with privacy controls, not strict deletion at the expense of finance-grade history.
- **D-09:** Financial, payroll, and audit records should preserve legally required history, while PII fields are pseudonymised where permitted and sessions/files are hard-deleted where appropriate.
- **D-10:** Data-subject-rights flows should be automated, traceable, and designed to complete within the required 72-hour window.
- **D-11:** Retention handling should be explicit and policy-driven for each required record class instead of ad hoc cleanup behavior.

### Documentation Contract

- **D-12:** Phase 18 documentation should follow a balanced platform-docs model rather than being developer-only or operator-only.
- **D-13:** The documentation set should include a strong top-level entrypoint plus focused guidance for developers, operators, and architecture/compliance readers.
- **D-14:** README, architecture/deployment guidance, observability/GDPR runbooks, ADRs, and API documentation should be treated as one coherent documentation surface for the platform.

### the agent's Discretion

- Exact OpenTelemetry bootstrap structure, exporter wiring, and instrumentation split across backend and ML runtime, so long as app telemetry remains the primary requirement and the platform layer stays thin
- Exact Grafana dashboard layout, panel composition, and Prometheus rule organization, so long as the chosen dashboards and alerts clearly cover API performance, business metrics, and a bounded infrastructure view
- Exact Terraform module split, state layout, and environment overlay structure, so long as AWS foundation plus platform glue are covered without absorbing unrelated deployment ownership
- Exact pseudonymisation field handling and DSR job orchestration details, so long as legally required records retain audit value and privacy workflows remain automated and traceable
- Exact documentation file structure and breakdown across README, runbooks, ADRs, and API references, so long as the balanced developer/operator/architect contract is preserved

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 18 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `OBS-01` through `OBS-04`, `CLOUD-01` through `CLOUD-03`, `GDPR-01` through `GDPR-04`, and `DOCS-01` through `DOCS-03`
- `.planning/PROJECT.md` - locked stack, SLA, compliance, and zero-hardcoded-secrets constraints
- `.planning/STATE.md` - current execution state and carry-forward notes into the final phase

### Prior phase context that constrains Phase 18

- `.planning/phases/14-security-hardening/14-CONTEXT.md` - strict session/security posture, explicit tenant access, and strong audit expectations that GDPR and docs work must preserve
- `.planning/phases/15-testing-strategy/15-CONTEXT.md` - release-confidence expectations and the existing runtime seams that observability and docs should build on
- `.planning/phases/16-containerization-kubernetes/16-CONTEXT.md` - locked Helm boundary, external dependency model, environment overlays, and GitOps-ready application packaging
- `.planning/phases/17-ci-cd-pipeline/17-CONTEXT.md` - locked GitOps promotion model, staging/prod environment overlays, and deployment ownership boundaries

### Existing observability and runtime seams

- `apps/api/src/main.ts` - API bootstrap seam where telemetry initialization and runtime wiring will have to integrate cleanly
- `apps/api/src/health/health.controller.ts` - current API health contract that monitoring and runtime validation already depend on
- `apps/api/src/bi/metrics/bi-metrics.service.ts` - existing business-metric computation seam that can inform custom business telemetry
- `apps/ml-service/main.py` - ML service runtime and health surface that needs observability coverage
- `infra/helm/amdox/values.yaml` - current OTLP and runtime config placeholders that show observability configuration is already anticipated in deployment values
- `infra/helm/amdox/values-staging.yaml` - environment-specific observability endpoint/config seam for staging
- `infra/helm/amdox/values-prod.yaml` - environment-specific observability endpoint/config seam for production

### Existing deployment and cloud-delivery seams

- `infra/argocd/README.md` - app-of-apps GitOps model, sync ordering, canary operations, and promotion flow that cloud work must support rather than replace
- `infra/argocd/apps/staging.yaml` - staging application definition that reflects current environment shape
- `infra/argocd/apps/prod.yaml` - production application definition that reflects current environment shape
- `infra/helm/amdox/README.md` - Helm chart contract and environment-overlay usage
- `.github/workflows/ci.yml` - current CI enforcement and artifact-validation surface that docs and cloud assumptions should stay aligned with
- `.github/workflows/deploy.yml` - current image-publish and GitOps promotion flow that Terraform and docs should complement

### Existing API and security documentation seams

- `apps/api/src/common/api/api-docs.ts` - current Swagger/OpenAPI bootstrap and production-protection behavior
- `apps/api/src/common/security/security-headers.ts` - current security-header baseline that documentation and compliance flows should respect
- `.env.example` - current environment-variable contract that README and platform docs must explain

### Documentation and architecture guidance

- `.planning/codebase/ARCHITECTURE.md` - current backend/runtime architecture notes useful for platform and operations documentation
- `.planning/codebase/CONVENTIONS.md` - established implementation conventions relevant to docs and cross-cutting observability work
- `.planning/codebase/STRUCTURE.md` - repository/package layout for documentation and deployment guidance
- `.planning/codebase/TESTING.md` - current testing and validation posture that operational docs should reflect accurately

No existing Terraform, Prometheus, Grafana, or GDPR-specific implementation files are present in the workspace yet. The references above plus the decisions in this context are the authoritative planning inputs for creating them.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `infra/helm/amdox/values*.yaml` already expose OTLP-related configuration seams, so Phase 18 can extend an existing deployment contract instead of inventing one.
- `apps/api/src/main.ts` already centralizes API bootstrap concerns such as global middleware, validation, CORS, versioning, and API docs setup, making it the natural integration point for backend observability bootstrap.
- `apps/api/src/bi/metrics/bi-metrics.service.ts` already computes high-value ERP business metrics that can inform the required custom business metrics and dashboard design.
- `apps/ml-service/main.py` already exposes a bounded service with a `/health` endpoint and a small runtime surface, which makes observability coverage straightforward to scope.
- `apps/api/src/common/api/api-docs.ts` already creates an OpenAPI 3.1 document and gated Swagger UI behavior, giving documentation work a real starting point instead of a blank slate.
- `infra/argocd/README.md` plus the environment app manifests already document the intended GitOps deployment shape, which platform docs can expand into operator-facing guidance.

### Established Patterns

- Platform ownership is intentionally split: Helm/ArgoCD own application deployment shape, while later infrastructure work is expected to provide managed backing services rather than re-platform the app tier.
- Secrets must stay out of git-managed config, so Terraform and documentation work must preserve the existing placeholder/secret-reference posture.
- The repo already prefers environment overlays (`dev`, `staging`, `prod`) over one-off runtime customization, so cloud and observability work should continue that pattern.
- API docs, security behavior, and deployment gating already assume a production-aware posture, which means Phase 18 should sharpen operational clarity without loosening prior controls.

### Integration Points

- Observability changes will need to connect application bootstrap, ML runtime, Helm values, and eventually dashboard/alert assets into one coherent telemetry path.
- Terraform must complement the existing GitOps deployment model by provisioning the managed AWS foundation and shared cloud glue that the app tier expects.
- GDPR automation will need to connect tenant-scoped application data, object-storage artifacts, audit expectations, and retention policy enforcement.
- Documentation work must tie together local setup, GitOps deployment, observability operations, API docs usage, and compliance procedures without contradicting the live code and workflows.

</code_context>

<specifics>
## Specific Ideas

- Keep telemetry operator-friendly: lead with application health and business-critical signals, then add only the minimum infrastructure golden signals needed to explain failures quickly.
- Treat Terraform as the managed-environment counterpart to the already-existing Helm and ArgoCD app-delivery layer, not as a second deployment system.
- Preserve ERP audit value during GDPR handling by pseudonymising or deleting the right things without corrupting legally significant history.
- Make the Phase 18 docs feel like a platform handoff package: one entrypoint for onboarding, plus focused operating guidance for deployment, observability, and compliance workflows.

</specifics>

<deferred>
## Deferred Ideas

- Expanding Phase 18 into a full platform-observability program that deeply covers every cluster and cloud subsystem
- Turning Terraform into an all-in-one bootstrap owner for every application, deployment, and operational concern
- Privacy behavior that aggressively deletes financial or audit history in ways that weaken regulatory or accounting traceability
- Operator-only or developer-only documentation that leaves one audience without a usable path through the platform

</deferred>

---

_Phase: 18-observability-cloud-gdpr-documentation_
_Context gathered: 2026-04-28_
