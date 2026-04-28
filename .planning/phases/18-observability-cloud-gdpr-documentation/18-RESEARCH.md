# Phase 18: Observability, Cloud, GDPR & Documentation - Research

**Date:** 2026-04-28
**Phase:** 18-observability-cloud-gdpr-documentation
**Status:** Complete

## What This Phase Needs To Solve

Phase 18 has to finish the platform foundation by adding four cross-cutting capabilities without breaking the deployment, security, and audit boundaries locked earlier:

- instrument the running application tier with production-grade telemetry for `api`, `api-worker`, and `ml-service`
- expose Prometheus-friendly metrics, Grafana dashboards, and actionable alert rules around both runtime and business health
- provision the AWS environment foundation plus the shared platform glue required by the existing Helm and ArgoCD delivery model
- implement GDPR data-subject-rights and retention workflows that preserve the ERP's audit and finance history where legally required
- publish the final platform documentation set across setup, architecture, operations, compliance, and API surface

The main design tension is that this phase spans application code, deployment config, cloud infrastructure, persistent data handling, and documentation all at once. The repo already has a strong app-tier GitOps contract from Phases 16 and 17, so the work here needs to extend that contract rather than invent a second deployment or operational model.

## Codebase Findings

### Existing assets that Phase 18 should reuse

- `.env.example` already defines the environment contract for:
  - `OTEL_EXPORTER_OTLP_ENDPOINT`
  - `OTEL_SERVICE_NAME`
  - `AWS_REGION`
  - `AWS_S3_BUCKET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_S3_ENDPOINT`
  - `AWS_S3_FORCE_PATH_STYLE`
  - `API_DOCS_ENABLED`
  - `API_DOCS_PROTECT`
- `apps/api/src/main.ts` already centralizes API bootstrap concerns and is the natural seam for backend telemetry bootstrap.
- `apps/api/src/worker.module.ts` already gives the repo a separate worker runtime shape, which is important because the user explicitly wants application telemetry as the hard requirement across both HTTP and background execution.
- `apps/api/src/health/health.controller.ts` already exposes a stable `/api/v1/health` probe that alerts and dashboards can anchor on.
- `apps/ml-service/main.py` already has a bounded FastAPI runtime with `/health`, which makes ML-service instrumentation and runtime verification straightforward to scope.
- `apps/api/src/bi/metrics/bi-metrics.service.ts` already computes several ERP business metrics that map well to the required custom business telemetry, especially:
  - forecast accuracy
  - payroll-related timing/throughput seams
  - active headcount and other business slices
- `infra/helm/amdox/values.yaml` and the environment overlays already model OTLP as an external dependency and carry environment-specific endpoint seams for staging and prod.
- `infra/argocd/README.md`, `infra/argocd/apps/staging.yaml`, and `infra/argocd/apps/prod.yaml` already lock the GitOps deployment shape that Terraform must support rather than replace.
- `apps/api/src/common/api/api-docs.ts` already generates OpenAPI 3.1 and provides environment-aware protection for Swagger UI.
- Storage services already exist for persisted artifacts:
  - `apps/api/src/ap-ar/storage/invoice-storage.service.ts`
  - `apps/api/src/payroll/storage/payslip-storage.service.ts`
  - `apps/api/src/bi/reports/bi-report-storage.service.ts`
    These prove the platform already depends on durable object storage and that GDPR/export behavior must include stored files, not only database rows.
- `apps/api/src/auth/auth.service.ts` already persists session records and revocation state, which matters for GDPR erasure handling and retention policy boundaries.

### Important constraints and gaps

- There are currently no repository-owned Terraform assets under `infra/` or elsewhere.
- There are currently no repository-owned Prometheus configs, alert rules, Grafana dashboards, or OTEL bootstrap modules.
- `apps/api/src/main.ts` does not currently initialize OpenTelemetry before application imports or expose any Prometheus metrics endpoint.
- The API and ML runtimes expose health, but there is no current trace, metric, or correlation-id telemetry path beyond the request-id middleware and existing health routes.
- The storage services upload artifacts to S3-compatible storage, but they currently return bucket/key or plain URL information rather than signed download URLs. That is directly relevant to `GDPR-01`, which requires encrypted JSON export with a signed download URL.
- The repo already uses soft-delete patterns across most Prisma models, but GDPR erasure requires more than soft deletion:
  - pseudonymisation for regulated records
  - hard deletion for sessions and some file artifacts
  - explicit retention enforcement by record class
- The Prisma schema already contains multiple PII-bearing models that Phase 18 has to classify correctly, including:
  - `User`
  - `UserSession`
  - `Employee`
  - `Customer`
  - `Vendor`
  - `Notification`
  - `AuditLog`
- `AuditLog`, payroll, and finance-linked data are exactly the categories where the user chose audit-first GDPR handling, so the plan cannot default to blanket deletion.
- The environment overlays still assume mutable `latest` tags in Helm, which is acceptable as carried-forward Phase 17 state but means Phase 18 docs must describe actual environment behavior truthfully rather than idealize it.
- There is no existing top-level project README in the repo root, even though the roadmap explicitly requires comprehensive setup and architecture documentation.

## Recommended Technical Direction

### 1. Add explicit telemetry bootstrap modules instead of scattering instrumentation

The backend should not bolt telemetry onto random service methods ad hoc. The cleaner design is:

- an early OpenTelemetry bootstrap path for the Nest API runtime
- the same telemetry contract applied to the worker runtime
- a lightweight but explicit metrics and tracing contract for the ML service

That keeps app, worker, and ML instrumentation aligned while honoring the user's choice that application telemetry is the hard requirement.

### 2. Treat Prometheus and Grafana assets as repo-owned operator artifacts

Because no monitoring assets currently exist in the repo, the plan should create a new repo-owned observability surface rather than hiding dashboards and alerts in prose. The cleanest fit is a dedicated `infra/observability/` or similarly scoped folder containing:

- Prometheus alert rules
- Grafana dashboard JSON or provisioning artifacts
- any supporting runbook references

This keeps the final operator docs truthful and reviewable in git.

### 3. Keep platform observability intentionally thin

The user explicitly chose a hybrid observability model. That means:

- deep instrumentation for the application tier
- a few infrastructure golden signals for operator triage
- no attempt to create a full cluster-platform observability program in this phase

The infrastructure layer should likely focus on:

- API latency and error rate
- worker/job health
- ML service health
- DB/Redis connectivity pressure or exhaustion signals
- one or two cloud/runtime health indicators that explain app incidents quickly

### 4. Use Terraform for AWS foundation plus platform glue only

The Terraform boundary should complement the existing Phase 16/17 GitOps model:

- EKS
- Aurora Serverless v2
- ElastiCache Redis
- S3
- WAF
- the networking, IAM, and service-account wiring those services require

It should not attempt to absorb:

- ArgoCD application delivery logic
- Helm application configuration ownership
- a full "everything in Terraform" environment bootstrap

The most compatible structure is a clear module split between shared foundation, environment overlays, and app-integration glue.

### 5. Model GDPR around data classes and legal constraints, even under the audit-first policy

Although the user chose "audit-first with privacy controls" rather than a fully tiered GDPR model, the implementation still needs an internal data-class strategy. The cleanest categories are:

- immutable or long-retention audit and finance records
- operational records with PII fields that can be pseudonymised
- session and auth records that can be hard-deleted or revoked
- stored artifacts such as invoices, payslips, and exports
- temporary export artifacts with short retention

That gives the system a truthful basis for:

- Right to Access export
- Right to Erasure pseudonymisation/deletion
- retention enforcement
- 72-hour workflow automation and auditability

### 6. Build DSR flows as explicit asynchronous jobs, not inline controller work

Given the volume and cross-cutting nature of the required export/erasure work, DSR processing should be planned as a background workflow rather than a single synchronous request path. The repo already has queue and worker patterns, so the best fit is:

- a request path that creates a DSR job record or command
- background processing in the worker runtime
- durable status/audit tracking
- object-storage-backed export artifact generation

This aligns with the platform's existing queue-heavy architecture and the 72-hour SLA requirement.

### 7. Upgrade artifact access toward signed URLs where the requirements demand them

`GDPR-01` explicitly calls for encrypted JSON export plus signed download URL behavior. Existing storage services are useful seams, but they currently stop short of signed access patterns. The plan should account for:

- encryption at rest in S3
- export object naming and lifecycle expiration
- signed URL generation for DSR exports
- short-lived access windows

The planner should not treat today's direct URL behavior in `BiReportStorageService` as acceptable for GDPR export artifacts.

### 8. Treat documentation as a platform handoff package, not a README-only chore

The user's balanced-docs choice is best satisfied by a documentation set that includes:

- root README for onboarding and setup
- architecture/deployment overview
- observability runbooks and dashboard/alert references
- GDPR and retention operations guide
- ADR set for the locked architecture decisions
- API docs usage and publication notes

This should be planned as first-class deliverables, not as a final cleanup task after code and infra are done.

## Repo Seams To Honor

### Telemetry and runtime seams

- `apps/api/src/main.ts` is the main API bootstrap seam.
- `apps/api/src/worker.module.ts` proves the worker runtime is already structurally separate from the HTTP app.
- `apps/ml-service/main.py` is the ML runtime seam and should not be treated as a hidden sub-process of the API.
- `apps/api/src/common/api/request-id.middleware.ts` already provides request correlation material that telemetry can build on.

### Deployment and infrastructure seams

- `infra/helm/amdox/values.yaml`, `values-staging.yaml`, and `values-prod.yaml` are already the environment contract for the app tier.
- `infra/argocd/apps/staging.yaml` and `infra/argocd/apps/prod.yaml` remain the GitOps deployment owners for the app workloads.
- `infra/helm/amdox/README.md` explicitly states OTLP collector, object storage, Redis, Keycloak, and database remain external dependencies to the chart.

### Data-handling seams

- `apps/api/src/auth/auth.service.ts` owns user-session lifecycle and revocation state.
- `apps/api/src/ap-ar/storage/invoice-storage.service.ts` owns invoice-source artifact persistence.
- `apps/api/src/payroll/storage/payslip-storage.service.ts` owns payslip artifact persistence.
- `apps/api/src/bi/reports/bi-report-storage.service.ts` owns BI report artifact persistence and currently exposes direct artifact URLs.
- `packages/db/prisma/schema.prisma` is the source of truth for the PII-bearing tables, retention-sensitive audit data, and forecast/audit/event records.

### Documentation seams

- `apps/api/src/common/api/api-docs.ts` is already the OpenAPI/Swagger publication seam.
- `.env.example` is the current runtime configuration contract and must be reflected accurately in docs.
- `.planning/codebase/*.md` already provide architecture, structure, convention, and testing material that the final docs should harmonize with rather than contradict.

## Common Pitfalls The Planner Should Avoid

### 1. Treating Phase 18 as "install observability everywhere"

The user did not choose full platform observability. A plan that tries to instrument every cluster and cloud layer equally will over-expand the phase and blur the app-first telemetry priority.

### 2. Letting Terraform absorb Helm or ArgoCD ownership

Phase 16 and 17 already locked the delivery model. Terraform should provision environment foundation and integration glue, not become a second deployment engine.

### 3. Using blanket deletion for GDPR

That would directly violate the chosen audit-first posture and would be especially dangerous for payroll, finance, and audit history.

### 4. Reusing direct public artifact URLs for GDPR exports

Current storage seams prove object-storage integration exists, but GDPR exports require stronger access control and expiry semantics than today's generic artifact links.

### 5. Treating soft-delete as sufficient GDPR erasure

The schema's `deletedAt` usage is valuable, but it is not equivalent to pseudonymisation, session destruction, or legal-retention enforcement.

### 6. Leaving documentation until the very end

Because the phase includes infrastructure, observability, compliance, and API publication, postponing docs entirely until after implementation will make it much harder to capture truthful operator procedures and constraints.

### 7. Planning observability only for the API

The user explicitly chose application telemetry across the platform's real runtimes, which means `api-worker` and `ml-service` cannot be left out.

## Validation Architecture

Phase 18 should validate across five layers:

- application bootstrap and test confidence for telemetry-aware backend and ML runtime changes
- infrastructure artifact validation for Terraform, observability assets, and deployment config
- configuration-surface validation for Helm values, API docs publication, and environment contracts
- GDPR workflow verification for export, erasure, retention, and file-handling behavior
- documentation truthfulness checks against the live code and generated artifacts

Recommended command set during execution:

- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- `pnpm --filter @amdox/api run test:smoke`
- `pnpm --filter @amdox/ml-service test`
- `pnpm build`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml`
- `rg "OTEL_|otel|api-docs|SwaggerModule|DocumentBuilder|AWS_S3_|BI_REPORT_" apps/api apps/ml-service infra/helm .env.example`
- `terraform fmt -check`
- `terraform validate`
- `terraform plan -var-file=environments/staging.tfvars`
- `terraform plan -var-file=environments/prod.tfvars`
- `rg "grafana|prometheus|alert|dashboard" infra`

Manual-only or environment-gated verification should remain for:

- confirming the real OTLP collector, Prometheus scrape config, and Grafana environment are reachable in staging/prod
- proving AWS IAM, IRSA or equivalent service-account wiring, and managed-service connectivity in the target account
- validating WAF behavior and external environment routing under the real cloud perimeter
- confirming DSR export delivery, signed URL expiry, and retention cleanup in a real object-storage environment
- reviewing documentation against real operator workflows that depend on secrets, cloud accounts, or managed services

## Planning Implication

The cleanest Phase 18 split is:

1. observability foundation:
   - telemetry bootstrap for API, worker, and ML runtime
   - custom business metrics surfaces
   - deployment/config seams for telemetry endpoints
2. observability operations:
   - Prometheus rules
   - Grafana dashboards
   - alert thresholds and operator runbook references
3. cloud foundation and platform glue:
   - Terraform structure
   - AWS managed services
   - IAM, networking, lifecycle, and environment overlays
4. GDPR data operations:
   - DSR export/erasure workflows
   - retention rules
   - file-artifact handling
   - compliance-oriented verification
5. documentation and API publication closeout:
   - root README
   - operations/compliance docs
   - ADR set
   - OpenAPI publication truthfulness

That ordering establishes telemetry and cloud contracts first, then adds the operator layer, then handles GDPR behavior with the real storage and session seams in view, and closes with the documentation set that explains the completed platform truthfully.
