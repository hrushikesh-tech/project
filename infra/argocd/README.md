# Amdox ArgoCD Layout

Phase 16 uses an app-of-apps structure.

## Structure

- `root-application.yaml` is the root ArgoCD `Application`
- `apps/dev.yaml` defines the dev child app
- `apps/staging.yaml` defines the staging child app
- `apps/prod.yaml` defines the prod child app

Each child app points at the shared Helm chart and selects the matching values overlay.

## Sync Behavior

Every child app enables automated sync with:

- `self-heal`
- `prune`

That means drift should be corrected automatically and removed resources should be cleaned up by ArgoCD.

## Sync-Wave Ordering

The rollout uses `argocd.argoproj.io/sync-wave` annotations with this intent:

- wave `0`: shared config, `Secret` placeholders, quota, and limit resources
- wave `1`: workloads, `Service`s, HPA, and PDB resources
- wave `2`: ingress, Istio `DestinationRule`, and `VirtualService`

This keeps traffic-layer resources from being applied before the workloads they reference.

## Canary Operations

The API canary is modeled through:

- a stable API deployment
- an optional canary API deployment
- an Istio `DestinationRule`
- an Istio `VirtualService`

The default split is `90/10` stable-to-canary.

Promotion means increasing the canary weight and then replacing the stable image/tag once confidence is high. Rollback means sending traffic back to stable and scaling down or retagging the canary deployment.

## Live Cluster Validation

The following checks still require a real cluster and ArgoCD controller:

- confirming sync-wave ordering during an actual sync
- verifying the public ingress wiring for the selected environment
- validating canary traffic distribution from Istio telemetry or request tagging

## Rollback

Use ArgoCD sync history or Helm revision rollback for the app workloads. If a bad canary is deployed:

1. set canary weight back to `0` or stable-only
2. sync the application
3. revert the canary image/tag if needed

This Phase 16 layout is intentionally limited to GitOps shape and canary behavior, not full CI/CD automation.

