# Phase 16: Containerization & Kubernetes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `16-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 16-Containerization & Kubernetes
**Areas discussed:** Chart Boundary, Traffic Model, Secrets And Config, Workload Split, GitOps Shape

---

## Chart Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| App workloads only | Deploy `web`, `api`, `ml-service`, plus their Kubernetes resources. Keep Postgres, Redis, Keycloak, Elasticsearch, and object storage external. | x |
| Mixed platform | Deploy app workloads plus a subset of platform services in-cluster. | |
| Mostly self-contained cluster | Deploy most supporting services in-cluster too. | |

**User's choice:** App workloads only.
**Notes:** The user also locked the external-dependency assumption to managed-style endpoints supplied through values and secrets rather than vague generic externalization.

---

## Traffic Model

| Option | Description | Selected |
|--------|-------------|----------|
| Split public surfaces | `web` on the main app domain, `api` on its own domain, auth/admin on a separate auth domain. | x |
| Single shared app host | Serve the API under the same hostname, typically via `/api`. | |
| Web-only public surface | Keep API and auth internal behind the web app. | |

**User's choice:** Split public surfaces.
**Notes:** For canary scope, the user chose API-first canarying: `api` gets the explicit 90/10 Istio split first, while `web` stays stable initially and `ml-service` remains internal.

---

## Secrets And Config

| Option | Description | Selected |
|--------|-------------|----------|
| Secret references and placeholders | Use Kubernetes `Secret` references with no real secret values committed. | x |
| External/sealed-secret style immediately | Model the manifests around a stricter external secret system from day one. | |
| Hybrid secret strategy | Use stricter external-secret style only for the highest-risk credentials. | |

**User's choice:** Secret references and placeholders.
**Notes:** The user also chose one shared base Helm values layer plus explicit `dev`, `staging`, and `prod` overlays.

---

## Workload Split

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated worker workloads | Separate background processing from the HTTP-serving API runtime. | x |
| API-contained jobs | Keep background jobs inside the main API pods for simplicity. | |
| Hybrid split | Separate only some jobs while leaving lighter scheduling in the API. | |

**User's choice:** Dedicated worker workloads.
**Notes:** For scheduling, the user chose Kubernetes `CronJob` only for truly cluster-scheduled tasks, while BullMQ-owned repeatable work stays in worker-managed queue flow.

---

## GitOps Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Root app-of-apps | One root ArgoCD application that points to environment-specific child applications. | x |
| Single application | One ArgoCD application for the whole platform initially. | |
| Standalone child apps only | Separate applications from day one with no root app. | |

**User's choice:** Root app-of-apps.
**Notes:** The user also chose deliberate sync ordering: shared config first, then application services, then traffic-layer resources such as Istio and ingress.

---

## the agent's Discretion

- Exact Dockerfile stage layout and image hardening mechanics
- Exact Kubernetes object granularity per workload
- Exact ArgoCD folder and child-application naming
- Exact Secret and values-file naming
- Exact mapping of job types to always-on workers vs cluster-scheduled jobs

## Deferred Ideas

- In-cluster deployment of major stateful platform services
- Full secret-manager integration in this phase
- Broad canary rollout across all public services from day one
- CI/CD pipeline ownership before Phase 17
- Cloud provisioning ownership before Phase 18
