---
phase: 16-containerization-kubernetes
plan: 03
subsystem: infra
tags: [istio, argocd, ingress, canary, gitops]
requires:
  - phase: 16-containerization-kubernetes
    provides: rendered app-tier Helm chart and values overlays from Plan 02
provides:
  - split-host ingress for web and api only
  - Istio DestinationRule and VirtualService canary resources for the API
  - root and child ArgoCD Application manifests with automated sync behavior
  - explicit sync-wave ordering across config, workloads, and traffic
affects: [17-ci-cd-pipeline, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      API-only canary rollout,
      app-of-apps GitOps structure,
      traffic resources ordered after workloads,
    ]
key-files:
  created:
    [
      infra/helm/amdox/templates/ingress.yaml,
      infra/helm/amdox/templates/destinationrule.yaml,
      infra/helm/amdox/templates/virtualservice.yaml,
      infra/argocd/root-application.yaml,
      infra/argocd/apps/dev.yaml,
      infra/argocd/apps/staging.yaml,
      infra/argocd/apps/prod.yaml,
    ]
  modified:
    [
      infra/helm/amdox/templates/api-deployment.yaml,
    ]
key-decisions:
  - "Kept auth external and exposed only the app-owned web and api hosts through ingress."
  - "Applied the 90/10 canary split only to the API, leaving web and ml-service outside the rollout policy for this phase."
  - "Used a root app plus per-environment child applications instead of a single monolithic ArgoCD application."
patterns-established:
  - "Traffic policy and GitOps manifests should encode ordering explicitly instead of relying on controller luck."
  - "Canary subsets are labeled directly on the API deployments and routed by service-level subsets."
requirements-completed: [K8S-02, K8S-03, K8S-04]
duration: multi-session
completed: 2026-04-26
---

# Phase 16-03: Traffic Policies And GitOps Manifests Summary

**Split-host ingress, API-only Istio canary routing, and an ArgoCD app-of-apps layout now define how the Phase 16 workloads are exposed and synchronized**

## Performance

- **Duration:** multi-session
- **Started:** 2026-04-26T08:24:35Z
- **Completed:** 2026-04-26T10:41:40+05:30
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- Added a values-driven TLS ingress that exposes only `web` and `api`.
- Implemented `DestinationRule` and `VirtualService` resources for a default `90/10` API canary split.
- Created ArgoCD root and child application manifests with automated sync, self-heal, prune, and explicit sync-wave ordering.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `infra/helm/amdox/templates/ingress.yaml` - split-host TLS ingress contract.
- `infra/helm/amdox/templates/destinationrule.yaml` and `virtualservice.yaml` - stable/canary subset and routing policy.
- `infra/argocd/root-application.yaml` and `infra/argocd/apps/*.yaml` - app-of-apps GitOps structure with environment overlays.
- `infra/helm/amdox/templates/api-deployment.yaml` - stable and optional canary deployment labeling for Istio subsets.

## Decisions Made

- Kept `repoURL` values as placeholders because repository targeting is deployment-environment specific and will be finalized before actual ArgoCD sync.
- Verified the staging Helm render again after adding traffic resources to ensure ingress and Istio artifacts coexist with the chart cleanly.
- Treated live canary behavior and sync-wave controller ordering as manual-only cluster checks, not something to fake in static YAML evidence.

## Deviations from Plan

- None in scope. The manifests were implemented as planned, with the main caveat being that live controller behavior still needs cluster validation.

## Issues Encountered

- None beyond the expected limitation that static rendering cannot prove live Istio traffic distribution or ArgoCD sync ordering.

## User Setup Required

Replace the placeholder ArgoCD `repoURL` entries before attempting a real sync.

## Next Phase Readiness

- CI/CD and cloud rollout work can now build on concrete ingress, canary, and GitOps artifact shapes instead of inventing them later.

---

_Phase: 16-containerization-kubernetes_
_Completed: 2026-04-26_
