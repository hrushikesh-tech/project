# Platform Architecture Overview

This document maps the current platform shape. It is intentionally balanced between development, operations, and architecture concerns so the repo has one truth for how the system is assembled and deployed.

## System Shape

```mermaid
flowchart LR
  User[End user] --> Web[apps/web]
  Web --> API[apps/api]
  API --> PG[(PostgreSQL / Aurora PostgreSQL)]
  API --> Redis[(Redis / ElastiCache)]
  API --> S3[(S3)]
  API --> KC[Keycloak]
  API --> ES[(Elasticsearch)]
  API --> ML[apps/ml-service]
  API --> Metrics[/metrics]
  ML --> MLMetrics[/metrics]
  API --> OTLP[OTLP collector]
  ML --> OTLP
  API --> Prom[Prometheus]
  ML --> Prom
  Prom --> Graf[Grafana]
  Terraform[infra/terraform] --> AWS[AWS foundation]
  Helm[infra/helm/amdox] --> K8s[Kubernetes workloads]
  Argo[ArgoCD] --> K8s
```

## Runtime Boundaries

- `apps/web` is the browser-facing Next.js application.
- `apps/api` is the NestJS modular monolith that owns the ERP business modules, tenant enforcement, GDPR requests, and API docs publication.
- `apps/ml-service` is a separate FastAPI runtime for forecasting and model lifecycle work.
- Shared packages keep types, database contracts, and UI primitives in one workspace.

The API runtime is the main system-of-record boundary for finance, HR, payroll, supply chain, BI, notifications, and compliance workflows. It initializes telemetry before the Nest application starts, mounts Prometheus metrics, and then exposes `/api/v1` plus `/api-docs`.

## Deployment Relationships

The deployment stack is intentionally split into control planes:

1. Terraform provisions the AWS substrate and shared platform glue.
2. Helm packages the app tier and environment overlays.
3. ArgoCD reconciles the Helm chart into the selected cluster.
4. Repo-owned observability assets define dashboards and alert rules.

That split keeps cloud provisioning, application rollout, and monitoring independent enough to evolve without collapsing into one giant deployment script.

## Data And Compliance Boundaries

- PostgreSQL is the primary transactional store.
- Redis supports caching and queue coordination.
- S3 stores durable application artifacts, such as payslips and GDPR exports.
- Keycloak provides SSO, roles, and session lifecycle control.
- GDPR requests are handled inside the API service today, with encrypted export artifacts and pseudonymisation for erasure.

The architecture keeps regulated history and operational cleanup separate on purpose. Audit and finance records remain available when the law requires it, while subject-identifying fields and ephemeral artifacts are redacted or deleted where allowed.

## Observability Boundaries

- The API and ML service emit Prometheus-compatible metrics from their own runtimes.
- OTLP traces are exported from the app runtimes when an endpoint is configured.
- Prometheus alert rules and Grafana dashboards are owned in `infra/observability`.

The observability boundary is app-first and deliberately thin on platform infrastructure. The only non-app alert dependency is database pressure, which expects a PostgreSQL exporter or an equivalent DB signal in the target environment.

## API Publication

The API uses Swagger/OpenAPI publication as an operator and developer aid, not as a separate service:

- Swagger UI lives at `/api-docs`
- the generated JSON lives at `/api-docs-json`
- the document is published as OpenAPI 3.1
- production access is controlled by `API_DOCS_ENABLED` and `API_DOCS_PROTECT`

See the root README for the current environment contract and the observability and GDPR runbooks for the operational entry points.
