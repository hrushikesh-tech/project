---
phase: 16
validation_type: phase_plan
status: completed
created_at: 2026-04-26
nyquist_compliant: true
wave_0_complete: true
---

# Phase 16 Validation - Containerization & Kubernetes

## Validation Scope

This validation plan covers planning completeness and execution-time evidence for the deployment packaging, Helm, Istio, and ArgoCD work in Phase 16.

## Requirements Coverage

| Requirement | Covered By                | Validation Notes |
| ----------- | ------------------------- | ---------------- |
| `K8S-01`    | `16-01`, `16-04`          | Runtime packaging, multi-stage image structure, non-root execution, and image-build evidence are established in the foundation wave and closed with final validation. |
| `K8S-02`    | `16-02`, `16-03`, `16-04` | Helm resources, values overlays, ingress, quotas, policies, and final render evidence are covered across chart, traffic, and closeout waves. |
| `K8S-03`    | `16-03`, `16-04`          | API stable/canary subsets plus `90/10` routing are introduced in the traffic wave and proven in render/manual verification closeout. |
| `K8S-04`    | `16-03`, `16-04`          | Root ArgoCD app, environment child apps, sync waves, and automated sync settings are planned in the GitOps wave and closed with manifest checks/documentation. |

## Task Traceability

| Task ID    | Validation Target |
| ---------- | ----------------- |
| `16-01-01` | Root `.dockerignore` and all three Dockerfiles exist and encode multi-stage build structure for `api`, `web`, and `ml-service`. |
| `16-01-02` | API, web, and ML runtime commands are container-safe, explicit, and usable without shell-dependent dev tooling. |
| `16-01-03` | API runtime split cleanly separates HTTP-serving and background-processing concerns for Kubernetes workloads. |
| `16-01-04` | Package builds and all three image builds complete successfully before chart work continues. |
| `16-02-01` | Helm chart skeleton and environment overlays exist with external dependency values and Secret placeholders. |
| `16-02-02` | Helm templates produce app-tier Deployments and Services for `web`, `api`, `api-worker`, and `ml-service`. |
| `16-02-03` | HPA, PDB, NetworkPolicy, ResourceQuota, and LimitRange templates exist and render with the expected workload bindings. |
| `16-02-04` | `helm template` succeeds for `dev`, `staging`, and `prod` overlays. |
| `16-03-01` | Ingress/TLS templates expose only the intended `web` and `api` public hosts while keeping auth external. |
| `16-03-02` | Istio `DestinationRule` and `VirtualService` render stable/canary API subsets with a `90/10` split. |
| `16-03-03` | Root and child ArgoCD Applications render with automated sync, self-heal, prune, and sync-wave ordering. |
| `16-03-04` | Traffic and GitOps artifacts pass static sanity checks together with the Helm chart output. |
| `16-04-01` | Root convenience scripts or equivalent documented commands cover build, image, and manifest verification. |
| `16-04-02` | This validation doc records the exact verification contract for every planned artifact. |
| `16-04-03` | Helm and ArgoCD runbooks describe external dependency wiring, canary promotion, and rollback expectations. |
| `16-04-04` | Final execution evidence captures all build/render commands plus residual manual checks for live cluster behavior. |

## Wave 0 Requirements

- [x] `.dockerignore` - container build context control for the monorepo
- [x] `apps/api/Dockerfile` - API image baseline
- [x] `apps/web/Dockerfile` - web image baseline
- [x] `apps/ml-service/Dockerfile` - ML image baseline
- [x] `infra/helm/amdox/Chart.yaml` - chart skeleton before deeper template work
- [x] `.planning/phases/16-containerization-kubernetes/16-VALIDATION.md` - validation contract before execution

## Verification Evidence

### Completed Command Evidence

- `pnpm --filter @amdox/api build` - passed on 2026-04-26 after the runtime split and worker bootstrap changes.
- `pnpm --filter @amdox/web build` - passed on 2026-04-26 when retried outside the sandbox after a Windows `spawn EPERM` permission issue.
- `pnpm --filter @amdox/ml-service test` - passed on 2026-04-26 after the package test script was updated to prefer the repo-local `.venv` Python interpreter.
- `docker build -f apps/api/Dockerfile .` - passed on 2026-04-26 outside the sandbox after the Docker daemon was confirmed healthy in Docker Desktop.
- `docker build -f apps/web/Dockerfile .` - passed on 2026-04-26 outside the sandbox and produced a working Alpine-based Next.js runtime image.
- `docker build -f apps/ml-service/Dockerfile .` - passed on 2026-04-26 after the image install path was slimmed to runtime-only Python dependencies and `torch` was left as an optional code path.
- `rg "ResourceQuota|LimitRange|NetworkPolicy|PodDisruptionBudget|HorizontalPodAutoscaler|egress|apiWorker|keycloak|redis" infra/helm/amdox -n` - confirmed chart coverage for quota/policy resources and external dependency wiring.
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-dev.yaml` - passed on 2026-04-26 after Helm was installed locally.
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml` - passed on 2026-04-26 and rendered ingress plus Istio traffic resources successfully.
- `helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml` - passed on 2026-04-26 and rendered the production overlay cleanly.
- `rg "Application|selfHeal: true|prune: true|argocd.argoproj.io/sync-wave" infra/argocd/root-application.yaml infra/argocd/apps/dev.yaml infra/argocd/apps/staging.yaml infra/argocd/apps/prod.yaml` - satisfied by the generated ArgoCD manifests and static file checks.
- `rg "VirtualService|DestinationRule|argocd.argoproj.io/sync-wave|selfHeal: true|prune: true" infra/helm/amdox infra/argocd` - passed on 2026-04-26 and confirmed the traffic-policy plus GitOps resources exist together.
- `kubectl exec -n phase16-validation curl -c curl -- sh -c '...'` - live Istio validation on a local kind cluster returned `179` stable responses and `21` canary responses out of `200` requests, matching the intended `90/10` split closely enough to validate the rollout policy in practice.
- `kubectl get application amdox-dev -n argocd -o yaml` - live ArgoCD validation on a local kind cluster showed `Namespace` creation in `PreSync`, then wave `0` config/governance resources, then wave `1` services/deployments/HPAs/PDBs, with wave `2` ingress and Istio traffic resources held back until workload health, proving sync-wave ordering on a real controller.

### Environment-Gated / Blocked Evidence

- None remaining after local kind, Istio, and ArgoCD validation completed on 2026-04-26.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| External auth hostname alignment | `K8S-02` | Completed through config-contract review because Phase 16 intentionally keeps auth external. | Verified the chart does not create auth ingress resources and that `hosts.auth` plus `KEYCLOAK_URL` remain externally configured values rather than chart-owned services. |
| Live `90/10` API canary behavior | `K8S-03` | Completed in a disposable local kind cluster with Istio installed. | Verified a synthetic stable/canary service using the same subset labels and `90/10` `VirtualService` model returned `179` stable and `21` canary responses over 200 requests. |
| ArgoCD sync-wave ordering | `K8S-04` | Completed in a disposable local kind cluster with ArgoCD installed. | Verified the live `amdox-dev` Application applied `PreSync` namespace creation first, then wave `0` config/governance resources, then wave `1` workloads, while wave `2` ingress and Istio resources waited on workload health. |

## Residual Risks And Manual Follow-Up

- The ArgoCD manifests now point at the real GitHub repository URL, but a real shared environment still needs these Phase 16 files committed and pushed before an external ArgoCD instance can sync from GitHub instead of the temporary local validation source.
- The local live canary validation used a synthetic echo workload to prove the Istio routing model. A future environment can still add an application-level smoke test once API dependencies are available in-cluster.

## Exit Condition

Phase 16 is validation-complete when:

- all planned artifacts exist
- package builds and all three image builds are green
- Helm renders are green for `dev`, `staging`, and `prod`
- static checks confirm canary and ArgoCD policy resources exist
- live canary and live ArgoCD sync-wave checks are complete, and any remaining note is operational publish follow-through rather than a Phase 16 implementation gap
