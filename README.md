# Amdox ERP Platform

Amdox is a multi-tenant ERP platform for finance, HR, payroll, supply chain, BI, forecasting, and compliance. The repo is organized as a workspace so the web app, API, ML service, shared packages, and platform assets can move together without splitting the release surface.

## Docs At A Glance

- [Architecture overview](docs/architecture/overview.md)
- [Observability runbook](docs/runbooks/observability.md)
- [GDPR operations runbook](docs/runbooks/gdpr-operations.md)
- [Architecture decisions](docs/adr/README.md)

## Quick Start

1. Install Node 20+ and pnpm 9+.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to your local `.env` and fill in real values for the services you want to run.
4. Start the workspace with `pnpm dev`.

The root workspace script fans out to the app-level `dev` commands. Use the package-level scripts when you want a narrower loop:

- `pnpm --filter @amdox/web dev`
- `pnpm --filter @amdox/api dev`
- `pnpm --filter @amdox/ml-service dev`

## Core Scripts

| Command                    | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `pnpm dev`                 | Run the workspace development servers through Turbo.    |
| `pnpm build`               | Build the workspace packages and apps.                  |
| `pnpm lint`                | Run linting across the workspace.                       |
| `pnpm typecheck`           | Run workspace TypeScript checks.                        |
| `pnpm security:secrets`    | Scan the repo for committed secrets.                    |
| `pnpm security:snyk`       | Run the Snyk policy check wrapper.                      |
| `pnpm security:trivy`      | Run the Trivy wrapper.                                  |
| `pnpm test:load`           | Run the k6 load-test wrapper.                           |
| `pnpm verify:phase16:helm` | Render the Helm chart against the environment overlays. |
| `pnpm verify:phase17:ci`   | Run the phase 17 CI verification chain.                 |

## What Runs Where

- `apps/web` is the Next.js front end.
- `apps/api` is the NestJS modular monolith and the main ERP backend.
- `apps/ml-service` is the FastAPI forecasting service.
- `packages/*` contains shared types, config, UI, and database contracts.
- `infra/helm/amdox` owns app-tier Kubernetes deployment manifests and environment overlays.
- `infra/observability` owns repo-local alerts and dashboards.
- `infra/terraform` owns the AWS foundation and platform glue.

## Architecture Summary

The platform keeps the responsibilities separated on purpose:

- the web app talks to the API over the versioned REST surface
- the API owns business workflows, auth, GDPR requests, and OpenAPI publication
- the ML service handles model training and prediction behind a separate runtime
- Terraform provisions the AWS substrate, while Helm and ArgoCD own application rollout
- observability assets live in the repo so alerts and dashboards stay versioned with the code

See [docs/architecture/overview.md](docs/architecture/overview.md) for the full runtime and deployment map.

## Environment Variables

The repo treats [.env.example](.env.example) as the source of truth for the local environment contract.

Key groups in that file include:

- runtime and ports
- inter-service URLs
- auth and API docs controls
- database and cache connectivity
- telemetry and observability settings
- AWS storage and GDPR export settings

When the root docs and the sample env file disagree, update both in the same change.

## Deployment Overview

Local development runs from the workspace scripts and sample env file. Production and staging are split across three layers:

- Terraform provisions the AWS foundation and shared cloud glue.
- Helm packages the app tier and environment overlays.
- ArgoCD reconciles the Helm manifests into the cluster.

The API publishes OpenAPI 3.1 docs at `/api-docs` and the raw JSON at `/api-docs-json`. In non-production, docs are enabled unless explicitly disabled. In production, docs are only enabled when `API_DOCS_ENABLED=true`, and they are protected with basic auth by default.

## Operational Entry Points

- [Observability runbook](docs/runbooks/observability.md)
- [GDPR operations runbook](docs/runbooks/gdpr-operations.md)
- [Architecture decisions](docs/adr/README.md)
