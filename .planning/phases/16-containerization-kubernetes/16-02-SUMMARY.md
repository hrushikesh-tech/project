---
phase: 16-containerization-kubernetes
plan: 02
subsystem: infra
tags: [helm, kubernetes, ingress, networkpolicy, hpa, pdb]
requires:
  - phase: 16-containerization-kubernetes
    provides: container images and API runtime split from Plan 01
provides:
  - a single application Helm chart for web, api, api-worker, and ml-service
  - environment overlays for dev, staging, and prod
  - values-driven external dependency and secret placeholder contracts
  - quota, limit, policy, HPA, and PDB templates for the app tier
affects: [16-03, 17-ci-cd-pipeline, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      app-tier-only Helm ownership,
      values-driven secret references,
      sync-wave-aware shared resource templating,
    ]
key-files:
  created:
    [
      infra/helm/amdox/Chart.yaml,
      infra/helm/amdox/values.yaml,
      infra/helm/amdox/values-dev.yaml,
      infra/helm/amdox/values-staging.yaml,
      infra/helm/amdox/values-prod.yaml,
    ]
  modified:
    [
      infra/helm/amdox/templates/api-deployment.yaml,
      infra/helm/amdox/templates/api-worker-deployment.yaml,
      infra/helm/amdox/templates/networkpolicy.yaml,
      infra/helm/amdox/templates/resourcequota.yaml,
      infra/helm/amdox/templates/limitrange.yaml,
    ]
key-decisions:
  - "Kept databases, redis, keycloak, object storage, and observability endpoints external to the chart and represented them only through values and Secret placeholders."
  - "Added Argo sync-wave annotations directly in the chart so config resources can apply before workloads even when synced through child applications."
  - "Modeled API canary as an optional secondary deployment path inside the Helm chart rather than a second chart."
patterns-established:
  - "Namespace governance resources live beside workload templates in the application chart."
  - "Environment overlays override values without embedding live credentials in git."
requirements-completed: [K8S-02]
duration: multi-session
completed: 2026-04-26
---

# Phase 16-02: Helm Chart And Environment Overlays Summary

**A single app-tier Helm chart now deploys the four runtime workloads with external dependency contracts, governance resources, and environment-specific overlays**

## Performance

- **Duration:** multi-session
- **Started:** 2026-04-26T08:24:35Z
- **Completed:** 2026-04-26T10:41:40+05:30
- **Tasks:** 4
- **Files modified:** 21

## Accomplishments

- Created `infra/helm/amdox` with a complete chart skeleton and base plus `dev`, `staging`, and `prod` overlays.
- Added workload templates for `web`, `api`, `api-worker`, `ml-service`, and the phase-owned `fx-refresh` CronJob path.
- Added the policy and governance layer: ConfigMap, Secret placeholder, HPA, PDB, NetworkPolicy, ResourceQuota, and LimitRange templates.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `infra/helm/amdox/values*.yaml` - image, hostname, secret, dependency, and environment overlay contract.
- `infra/helm/amdox/templates/*deployment.yaml` and `*service.yaml` - app-tier workload and service definitions for the four runtime surfaces.
- `infra/helm/amdox/templates/configmap.yaml` and `secret-placeholder.yaml` - non-secret and secret-key wiring model.
- `infra/helm/amdox/templates/hpa.yaml`, `pdb.yaml`, `networkpolicy.yaml`, `resourcequota.yaml`, `limitrange.yaml` - scaling, availability, and namespace governance controls.

## Decisions Made

- Scoped Helm ownership strictly to application workloads so platform dependencies remain externally managed.
- Kept the worker as a first-class deployment contract in values and templates instead of hiding it behind API deployment assumptions.
- Installed Helm locally and rendered the chart for all three overlays so the chart evidence is real rather than speculative.

## Deviations from Plan

- None in scope. The only operational wrinkle was the need to install Helm locally before render verification could run.

## Issues Encountered

- Helm was not initially available in the shell environment, so it had to be installed before `helm template` verification could be completed.

## User Setup Required

Operators still need to replace placeholder Secret values and set real external service endpoints before using the chart in a cluster.

## Next Phase Readiness

- Traffic and GitOps layers can now reference stable chart names, values overlays, and sync-wave-ready shared resources.

---

_Phase: 16-containerization-kubernetes_
_Completed: 2026-04-26_
