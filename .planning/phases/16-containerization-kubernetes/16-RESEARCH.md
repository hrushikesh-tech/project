# Phase 16: Containerization & Kubernetes - Research

**Date:** 2026-04-26
**Phase:** 16-containerization-kubernetes
**Status:** Complete

## What This Phase Needs To Solve

Phase 16 has to turn the existing monorepo into a production-packaged application tier that can run on Kubernetes without changing the earlier product boundary decisions. That means:

- shipping hardened multi-stage images for `api`, `web`, and `ml-service`
- keeping Postgres, Redis, Keycloak, Elasticsearch, and object storage external to the chart
- separating HTTP-serving and background-processing responsibilities so Kubernetes can scale them differently
- encoding the environment contract through Helm values and Kubernetes Secret references rather than committing secret values
- exposing only the app-tier public surfaces with TLS ingress and an API-first Istio canary
- creating an ArgoCD app-of-apps structure that later CI/CD and cloud phases can extend instead of replace

The hardest design tension is that the current API runtime still combines HTTP bootstrap, BullMQ processors, and Nest schedule work in one process, while the user's locked Phase 16 decisions require a cleaner split between public API traffic, background execution, and cluster-owned rollout behavior.

## Codebase Findings

### Existing assets that Phase 16 should reuse

- `docker-compose.yml` already documents the local dependency inventory and the baseline service names and ports for TimescaleDB, Redis, Keycloak, Elasticsearch, and Mailpit.
- `.env.example` already exposes the main runtime contract for:
  - `PORT_WEB`, `PORT_API`, `PORT_ML`
  - `NEXT_PUBLIC_API_URL`, `ML_SERVICE_URL`
  - `DATABASE_URL`, `REDIS_URL`, `KEYCLOAK_URL`
  - S3-related env vars
  - observability endpoint placeholders
- `apps/api/src/main.ts` already:
  - binds on `0.0.0.0`
  - uses env-driven API port selection
  - exposes `/api/v1`
  - includes cluster-worker support via `CLUSTER_WORKERS`
- `apps/api/src/health/health.controller.ts` already provides a public API health seam suitable for Kubernetes probes.
- `apps/ml-service/main.py` already exposes `/health` and has a simple FastAPI process shape.
- `apps/ml-service/package.json` already declares the service start contract as `uvicorn main:app`.
- `apps/api/src/app.module.ts` already imports `ScheduleModule` and every business module into one Nest runtime, so a runtime split has to be deliberate rather than assumed.
- Existing BullMQ processors already exist across the API codebase:
  - AP/AR OCR
  - HR operations
  - payroll
  - supply chain
  - BI reporting
  - forecasting
  - notifications
- `apps/api/src/notifications/outbox-poller.service.ts` already runs a 5-second application-owned poll loop that claims durable outbox events and enqueues delivery work.

### Important constraints and gaps

- There are no current `Dockerfile`, `.dockerignore`, Helm, Istio, or ArgoCD artifacts in the repo.
- The root monorepo build contract assumes CLI-driven development, not container-native runtime commands.
- `apps/api/package.json` currently uses `nest start` as the runtime script, which is not the right final contract for a distroless production image.
- `apps/ml-service/package.json` starts `uvicorn main:app` without explicit host binding, which is unsafe for container reachability because `uvicorn` defaults to `127.0.0.1`.
- The API's cluster-worker model (`CLUSTER_WORKERS`) is a poor default for Kubernetes because pod replication and HPA already provide the main concurrency model.
- Background processors and scheduled work currently load in the same app graph as the public API, which would make request traffic, BullMQ processing, and cron behavior scale together unless the runtime is split.
- The user explicitly rejected in-cluster ownership of Keycloak, Redis, Postgres, Elasticsearch, and object storage for this phase, so the chart must model them as external contracts instead of shipping convenience subcharts.

## Recommended Technical Direction

### 1. Keep the deployable boundary app-only

Phase 16 should create one application chart for:

- `web`
- `api`
- `api-worker`
- `ml-service`

It should not deploy:

- Postgres
- Redis
- Keycloak
- Elasticsearch
- S3-compatible storage

Those remain external dependencies passed in through Helm values and Kubernetes Secrets.

### 2. Use one-process-per-pod runtime contracts

For Kubernetes, the cleanest runtime model is:

- `api`: one Nest HTTP process, no in-process clustering by default
- `api-worker`: one Nest application-context process for BullMQ processors and application-owned poll/schedule work
- `ml-service`: one FastAPI `uvicorn` process bound to `0.0.0.0`
- `web`: one `next start` process bound for cluster reachability

This means the API image should run built JS directly (for example `node dist/src/main.js`) rather than relying on `nest start` inside the runtime container.

### 3. Split HTTP traffic from background execution explicitly

The current `AppModule` imports all queues and schedulers into the main runtime, so Phase 16 should plan for an explicit runtime split rather than trying to scale the existing all-in-one process:

- `api` runtime serves HTTP only
- `api-worker` runtime owns BullMQ processors
- queue-owned repeatable work stays app-owned
- truly cluster-scheduled jobs may be represented as Kubernetes `CronJob` resources where appropriate

This matches the locked user decision: keep queue-owned repeatables in BullMQ flow, and only use `CronJob` where the cadence belongs to the cluster rather than to a continuously running worker.

### 4. Disable Kubernetes-hostile API clustering

`apps/api/src/main.ts` currently supports `CLUSTER_WORKERS`. In Kubernetes, Phase 16 should plan around:

- `CLUSTER_WORKERS=1` in containerized runtimes by default
- pod-level scaling through HPA instead of in-pod worker forking

Without that guard, the repo would stack process forking on top of pod autoscaling and make sizing, observability, and graceful shutdown behavior harder to reason about.

### 5. Keep secrets out of git and use values overlays

The Helm structure should follow the user's locked config model:

- one shared `values.yaml`
- environment overlays for `dev`, `staging`, and `prod`
- Kubernetes `Secret` references and placeholders only
- no committed secret payloads

This is the most honest fit for the current phase because it does not pretend external secret-manager integration is already solved.

### 6. Expose only the app-tier public hosts

The traffic contract should be:

- `web` host exposed publicly
- `api` host exposed publicly
- auth/admin host remains external because Keycloak is not part of the chart
- `ml-service` remains internal-only

This means the chart ingress should cover `web` and `api`, while `KEYCLOAK_URL` points at the externally managed auth host.

### 7. Use API-only Istio canary routing first

The cleanest implementation of `K8S-03` is:

- `DestinationRule` with `stable` and `canary` subsets for the API workload
- `VirtualService` sending `90%` traffic to `stable` and `10%` to `canary`
- `web` remains on a stable-only route initially
- `ml-service` stays internal

This gives Phase 16 a simple progressive-delivery story that satisfies the roadmap without overcomplicating every public workload from day one.

### 8. Use ArgoCD app-of-apps with sync waves

The GitOps shape should be:

- one root ArgoCD Application
- one child Application per environment (`dev`, `staging`, `prod`)
- sync ordering that applies shared config first, workloads second, and traffic resources last

This matches the user decision and leaves a clean seam for Phase 17 CI/CD and Phase 18 cloud environment work.

## Recommended Artifact Layout

The repo structure that best matches the current monorepo is:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `apps/ml-service/Dockerfile`
- `.dockerignore`
- `infra/helm/amdox/*`
- `infra/argocd/*`

This keeps deployment assets close to the current `infra/` area without pretending the app code itself lives under an infrastructure mono-folder.

## Repo Seams To Honor

### API runtime and worker split

- `apps/api/src/main.ts` is currently the HTTP bootstrap.
- `apps/api/src/app.module.ts` is currently the single combined Nest graph.
- `apps/api/src/notifications/outbox-poller.service.ts` proves at least one scheduler currently lives inside the application runtime.
- multiple `@Processor(...)` classes under `apps/api/src/*/queue/*.processor.ts` prove that worker concerns are already present and should not remain coupled to public HTTP scale.

### External dependency contract

- `.env.example` is already the source of truth for runtime dependency variables.
- `apps/api/src/auth/auth.service.ts` and `apps/api/src/auth/strategies/jwt.strategy.ts` confirm hard dependency on external Keycloak and Redis.
- `apps/api/src/ap-ar/storage/invoice-storage.service.ts`, `apps/api/src/payroll/storage/payslip-storage.service.ts`, and `apps/api/src/bi/reports/bi-report-storage.service.ts` confirm object storage remains an external contract.
- `apps/api/src/forecasting/forecasting.client.ts` depends on `ML_SERVICE_URL`, confirming the API-to-ML service boundary should remain a separate service in Kubernetes.

### Build and verification contract

- `apps/api/package.json` uses `nest build`
- `apps/web/package.json` uses `next build`
- `apps/ml-service/package.json` has no compile step but does have a real `python -m pytest tests -q` test command
- `packages/db/package.json` and `packages/types/package.json` define the dependent build steps that still need to stay green as deployment artifacts are introduced

## Common Pitfalls The Planner Should Avoid

### 1. Keeping `nest start` as the final API container entrypoint

That works for dev tooling but is the wrong final shape for a distroless production image. The container should run built JS directly.

### 2. Leaving the ML service on loopback-only binding

`uvicorn main:app` without `--host 0.0.0.0` will produce a container that appears healthy internally but is unreachable from the cluster network.

### 3. Scaling API pods while queue processors still live inside them

That would bind request traffic and background throughput together, violating the user's workload-split decision and making HPA behavior misleading.

### 4. Shipping stateful platform services in the Phase 16 chart

That would directly contradict the chart-boundary decision and create churn with the later AWS/Terraform phases.

### 5. Treating auth ingress as chart-owned

Because Keycloak is external in this phase, the chart should not try to own the auth/admin ingress stack. It should only consume the external auth URL contract.

### 6. Committing values files that contain real secrets

Phase 14 already locked the project's secrets posture. Phase 16 must use placeholders and Secret refs, not "temporary" plaintext values.

### 7. Layering in-pod `CLUSTER_WORKERS` on top of Kubernetes HPA

That duplicates scaling models and complicates process accounting, graceful shutdown, and resource tuning.

## Validation Architecture

Phase 16 should validate across four layers:

- runtime builds for the existing monorepo packages that the containers package
- Docker image builds for `api`, `web`, and `ml-service`
- Helm render/lint checks across `dev`, `staging`, and `prod`
- GitOps manifest and traffic-policy sanity checks for ArgoCD + Istio resources

Recommended command set during execution:

- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/web build`
- `pnpm --filter @amdox/ml-service test`
- `docker build -f apps/api/Dockerfile .`
- `docker build -f apps/web/Dockerfile .`
- `docker build -f apps/ml-service/Dockerfile .`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-dev.yaml`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml`
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml`
- `rg "VirtualService|DestinationRule|argocd.argoproj.io/sync-wave|selfHeal: true|prune: true" infra/helm/amdox infra/argocd`

Wave 0 should include:

- `.dockerignore`
- all three Dockerfiles
- explicit API worker/runtime entrypoint wiring
- Helm chart skeleton and values overlays
- `16-VALIDATION.md`

Manual-only verification should remain for:

- confirming the external auth hostname contract matches the target cluster
- validating the API canary route against a live ingress/Istio environment
- validating ArgoCD sync order in a real controller environment

## Planning Implication

The cleanest plan split for Phase 16 is:

1. runtime packaging foundation: Dockerfiles, `.dockerignore`, and API worker/runtime split
2. Helm chart and environment overlays for app-tier workloads, quotas, policies, and external dependency wiring
3. split-host ingress, API-only Istio canary, and ArgoCD app-of-apps manifests with sync waves
4. final verification wiring and operator documentation so the phase closes with render/build evidence instead of only YAML creation

That ordering establishes runnable images first, then the chart contract, then rollout/GitOps behavior, and finally the validation/runbook closeout needed before CI/CD automation builds on top of it.
