# Amdox ArgoCD Layout

Phase 16 uses an app-of-apps structure.

## Structure

- `root-application.yaml` is the root ArgoCD `Application`
- `apps/dev.yaml` defines the dev child app
- `apps/staging.yaml` defines the staging child app
- `apps/staging-local.yaml` defines the local kind-only staging child app
- `apps/prod.yaml` defines the prod child app

Each child app points at the shared Helm chart and selects the matching values overlay.

## Local Kind Validation

For local Phase 17 proof work, use `apps/staging-local.yaml` instead of mutating the real staging application.

- it targets the `amdox-staging-local` namespace
- it uses `values-staging-local.yaml`
- it assumes ingress access through `kubectl port-forward` on the ingress controller
- it uses temporary hostnames:
  - `web.127.0.0.1.sslip.io:8080`
  - `api.127.0.0.1.sslip.io:8080`
  - `auth.127.0.0.1.sslip.io:8080`

This local overlay is for workstation validation only and should not be used as the GitHub Actions promotion target.

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

## Phase 17 Promotion Flow

Phase 17 adds GitHub Actions-driven GitOps promotion on top of the Phase 16 manifests:

1. `CI` validates pull requests and `main` with lint, typecheck, unit, integration, browser E2E, secrets, Snyk, Trivy, and build gates.
2. `Deploy` runs only from successful `main` CI completion.
3. The deploy workflow builds one immutable tag family for:
   - `ghcr.io/hrushikesh-tech/amdox-web`
   - `ghcr.io/hrushikesh-tech/amdox-api`
   - `ghcr.io/hrushikesh-tech/amdox-ml-service`
4. Staging promotion updates `infra/helm/amdox/values-staging.yaml` with those tags through `scripts/release/update-image-tags.mjs` and pushes a narrow bot-authored commit back to `main`.
5. ArgoCD reconciles the watched staging application from git. The deploy workflow waits for staging health before smoke starts.
6. The staging gate then runs:
   - API release smoke against `https://api.staging.amdox.example`
   - browser release smoke against `https://web.staging.amdox.example`
7. Production promotion is blocked behind the GitHub `production` environment approval. After approval, the same immutable tag set is written into `infra/helm/amdox/values-prod.yaml`.

This workflow intentionally does not call `kubectl apply` or `helm upgrade`. ArgoCD remains the deployment owner.

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

For the Phase 17 staging and production flows, rollback should happen as another git-backed promotion action:

1. identify the last known-good immutable tag in git history
2. update `values-staging.yaml` or `values-prod.yaml` back to that tag with `scripts/release/update-image-tags.mjs`
3. commit and push the revert or tag-restoration change
4. allow ArgoCD to reconcile the selected environment back to the known-good artifact set

That keeps rollback auditability in the same repo and commit history as forward promotion.
