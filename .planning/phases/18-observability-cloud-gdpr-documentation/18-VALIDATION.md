---
phase: 18
validation_type: phase_plan
status: execution_complete
created_at: 2026-04-28
nyquist_compliant: true
wave_0_complete: true
---

# Phase 18 Validation - Observability, Cloud, GDPR & Documentation

## Validation Scope

This validation plan covers planning completeness and execution-time evidence for telemetry bootstrap, monitoring artifacts, Terraform-managed AWS foundation, GDPR data-subject-rights workflows, retention policy enforcement, and final platform documentation/API publication in Phase 18.

## Requirements Coverage

| Requirement | Covered By       | Validation Notes                                                                                                                                                               |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OBS-01`    | `18-01`, `18-02` | Telemetry bootstrap plus observability operations artifacts together cover OTLP traces and Prometheus metrics exposure.                                                        |
| `OBS-02`    | `18-01`, `18-02` | Application instrumentation and dashboard work together cover the required business metrics contract.                                                                          |
| `OBS-03`    | `18-02`          | Grafana dashboards are explicitly owned in the observability-operations slice.                                                                                                 |
| `OBS-04`    | `18-02`          | Prometheus alert rules and threshold wiring are validated as repo-owned observability artifacts.                                                                               |
| `CLOUD-01`  | `18-03`          | Terraform-managed AWS foundation covers EKS, Aurora, ElastiCache, S3, and related service wiring.                                                                              |
| `CLOUD-02`  | `18-03`          | WAF ownership belongs in the cloud-foundation slice and requires targeted environment validation.                                                                              |
| `CLOUD-03`  | `18-03`          | Environment-specific infrastructure overlays or tfvars are validated as part of the Terraform contract.                                                                        |
| `GDPR-01`   | `18-04`          | Access export, encrypted artifact handling, and signed download behavior are validated in the GDPR slice.                                                                      |
| `GDPR-02`   | `18-04`          | Erasure behavior is validated as pseudonymisation plus hard deletion where allowed, not blanket deletion.                                                                      |
| `GDPR-03`   | `18-04`          | The DSR workflow now persists a traceable request state machine, but request processing is still executed inline in the service rather than via a dedicated background worker. |
| `GDPR-04`   | `18-04`          | Retention notes/utilities are explicit by record class and artifact type, including export expiry and object-storage cleanup helpers.                                          |
| `DOCS-01`   | `18-05`          | Root README, setup, env var reference, and architecture/deployment guidance are validated as first-class outputs.                                                              |
| `DOCS-02`   | `18-05`          | ADR creation and completeness are validated in the docs closeout slice.                                                                                                        |
| `DOCS-03`   | `18-05`          | OpenAPI 3.1 publication and documentation truthfulness are validated against the real API docs seam.                                                                           |

## Task Traceability

| Task ID    | Validation Target                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `18-01-01` | The API runtime initializes telemetry before or at the correct bootstrap seam and preserves existing runtime behavior.                                                                                                                                       |
| `18-01-02` | The worker runtime receives the same telemetry contract for queue and schedule execution paths.                                                                                                                                                              |
| `18-01-03` | The ML service exposes the required telemetry and health surfaces without diverging from its existing runtime contract.                                                                                                                                      |
| `18-01-04` | Required business metrics are emitted or derived from the live platform seams rather than invented out of band.                                                                                                                                              |
| `18-02-01` | Repo-owned Prometheus alert rules exist for API latency, error rate, DB pressure, payroll failure, and forecast quality thresholds.                                                                                                                          |
| `18-02-02` | Three Grafana dashboards exist and align to API performance, business metrics, and thin infrastructure visibility.                                                                                                                                           |
| `18-02-03` | Observability config integrates cleanly with Helm values and environment overlays already used by staging/prod. The DB-pressure alert is intentionally backed by an external PostgreSQL exporter or equivalent DB pressure signal in the target environment. |
| `18-02-04` | Operator-facing observability notes or runbooks match the actual dashboards and alert assets.                                                                                                                                                                |
| `18-03-01` | Terraform structure exists for shared foundation, environment-specific overlays, and managed-service ownership boundaries.                                                                                                                                   |
| `18-03-02` | AWS managed services and required platform glue are represented without absorbing Helm or ArgoCD ownership.                                                                                                                                                  |
| `18-03-03` | Terraform validation and plan commands succeed for the intended environments or fail only on expected external prerequisites.                                                                                                                                |
| `18-03-04` | WAF, IAM, S3 lifecycle, and environment-specific inputs are present and documented truthfully.                                                                                                                                                               |
| `18-04-01` | DSR export workflow produces encrypted JSON artifacts with signed download semantics.                                                                                                                                                                        |
| `18-04-02` | DSR erasure workflow pseudonymises allowed PII fields while preserving regulated audit/finance history.                                                                                                                                                      |
| `18-04-03` | Session and file cleanup behavior is explicit for auth and object-storage artifacts.                                                                                                                                                                         |
| `18-04-04` | Retention jobs or policies cover AuditLog, payroll, notifications, outbox events, and export artifact expiry.                                                                                                                                                |
| `18-05-01` | Root README covers architecture, setup, environment variables, and script usage accurately.                                                                                                                                                                  |
| `18-05-02` | ADR files exist for the required architecture decisions and match the implemented system truthfully.                                                                                                                                                         |
| `18-05-03` | OpenAPI docs remain 3.1, environment-aware, and aligned with the documented `/api-docs` posture.                                                                                                                                                             |
| `18-05-04` | Operations/compliance docs accurately describe observability, cloud, and GDPR procedures without contradicting code or infra assets.                                                                                                                         |

## Phase 18-04 Execution Evidence

- `pnpm --filter @amdox/db build` completed successfully and regenerated the Prisma client with the new GDPR request enums/model.
- `pnpm --filter @amdox/api build` completed successfully after the GDPR module, auth cleanup helper, and storage helpers were added.
- Live runtime verification against Keycloak, S3, and a seeded tenant database was not performed in this workspace, so the export download token, artifact deletion, and pseudonymisation behavior remain compile-verified rather than environment-verified.

## Wave 0 Requirements

- [x] `.planning/phases/18-observability-cloud-gdpr-documentation/18-CONTEXT.md` - locked user decisions for observability, cloud, GDPR, and documentation
- [x] `.planning/phases/18-observability-cloud-gdpr-documentation/18-RESEARCH.md` - research-backed implementation direction before planning
- [x] `.planning/phases/18-observability-cloud-gdpr-documentation/18-VALIDATION.md` - the phase validation contract itself
- [x] `infra/observability/` or equivalent repo-owned monitoring artifact folder - Wave 0 creates the monitoring asset surface if missing
- [x] `infra/terraform/` or equivalent repo-owned Terraform root - Wave 0 creates the infrastructure artifact surface if missing
- [x] Root `README.md` - Wave 0 or an early docs slice creates the missing top-level platform entrypoint

## Verification Contract

### Completed Command Evidence

- `pnpm --filter @amdox/db build` completed successfully on 2026-04-28 after the GDPR Prisma schema additions landed.
- `pnpm --filter @amdox/api build` completed successfully on 2026-04-28 with the telemetry bootstrap, GDPR module wiring, and storage helper changes in place.
- `pnpm --filter @amdox/ml-service test` completed successfully on 2026-04-28 with `8` passing tests; the only residual output was pre-existing Python `datetime.utcnow()` deprecation warnings.
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml` completed successfully on 2026-04-28 and rendered the staging overlay with telemetry config and the OTLP `4318` egress contract.
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml` completed successfully on 2026-04-28 and rendered the production overlay with the same telemetry contract.
- `pnpm --filter @amdox/api run test:unit` completed successfully on 2026-04-28 outside the Windows sandbox with `72/72` passing tests.
- `pnpm --filter @amdox/api run test:integration` completed successfully on 2026-04-28 outside the Windows sandbox with `23/23` passing tests.
- `terraform version` completed successfully on 2026-04-28 after installing Terraform `v1.14.9`.
- `terraform init -input=false` completed successfully on 2026-04-28 and installed the required `hashicorp/aws` and `hashicorp/tls` providers.
- `terraform fmt -recursive` completed successfully on 2026-04-28 after normalizing the checked-in Terraform files.
- `terraform validate` completed successfully on 2026-04-28 after fixing the ElastiCache replication-group arguments for the installed AWS provider.
- `terraform plan -input=false -refresh=false '-var-file=environments/staging.tfvars'` now fails only because no AWS credential source is configured in this environment.
- `terraform plan -lock=false -input=false -refresh=false '-var-file=environments/prod.tfvars'` now fails only because no AWS credential source is configured in this environment.

### Planned Command Evidence

- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- `pnpm --filter @amdox/api run test:smoke`
- `pnpm --filter @amdox/ml-service test`
- `pnpm build`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml`
- `rg "OTEL_|otel|api-docs|SwaggerModule|DocumentBuilder|AWS_S3_|BI_REPORT_" apps/api apps/ml-service infra/helm .env.example`
- `rg "grafana|prometheus|alert|dashboard" infra`
- `terraform fmt -check`
- `terraform validate`
- `terraform plan -var-file=environments/staging.tfvars`
- `terraform plan -var-file=environments/prod.tfvars`

### Environment-Gated / Manual Verifications

| Behavior                                                   | Requirement                          | Why Manual                                                                                   | Test Instructions                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real OTLP, Prometheus, and Grafana connectivity            | `OBS-01` / `OBS-03` / `OBS-04`       | Requires staging/prod telemetry backends and scrape configuration outside the repo.          | In the target environment, confirm traces arrive, Prometheus scrapes the expected metrics, dashboards render, and alert rules evaluate against live signals.          |
| AWS managed-service connectivity and identity wiring       | `CLOUD-01` / `CLOUD-02` / `CLOUD-03` | Depends on real cloud accounts, IAM/IRSA, networking, and managed-service availability.      | Run Terraform plan/apply in the target environment, then validate app-tier connectivity to Aurora, Redis, S3, and any WAF/DNS edges.                                  |
| Signed DSR export delivery and expiry                      | `GDPR-01` / `GDPR-03`                | Requires real object storage, credentials, and time-bound signed access behavior.            | Trigger a DSR export in a non-prod environment, confirm encrypted artifact generation, validate signed URL access, and verify expiration after the configured window. |
| Audit-safe erasure handling on real tenant data            | `GDPR-02` / `GDPR-04`                | Needs seeded regulated records and careful human review of pseudonymisation results.         | Execute a non-prod DSR erasure flow, inspect preserved audit/finance records, and confirm only allowed fields are pseudonymised or deleted.                           |
| Documentation truthfulness against live operator workflows | `DOCS-01` / `DOCS-02` / `DOCS-03`    | Some documented procedures depend on real credentials, dashboards, and cloud infrastructure. | Follow the README, observability runbook, and GDPR ops guide in a fresh environment and confirm the documented commands and URLs match the actual system.             |

## Exit Condition

Phase 18 is validation-complete when:

- telemetry bootstrap and observability assets exist and match the chosen app-first hybrid model
- Terraform owns AWS foundation plus platform glue without replacing Helm or ArgoCD deployment ownership
- GDPR export, erasure, and retention workflows are explicit, auditable, and consistent with the audit-first policy
- root platform docs, ADRs, and OpenAPI publication are present and truthful
- any remaining blockers are external environment or credential prerequisites, not missing repo contracts

That condition is now met for the repository portion of the phase. The only outstanding items are environment-gated validation steps for live telemetry backends, AWS-backed Terraform planning with real credentials, and live GDPR/cloud runtime checks.
