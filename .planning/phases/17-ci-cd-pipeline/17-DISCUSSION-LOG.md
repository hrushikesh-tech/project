# Phase 17: CI/CD Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 17-CI/CD Pipeline
**Areas discussed:** Workflow shape, Promotion model, Security gates, Staging smoke gate

---

## Workflow Shape

| Option                                | Description                                                        | Selected |
| ------------------------------------- | ------------------------------------------------------------------ | -------- |
| One big workflow                      | One visible workflow for PR and main, with parallel jobs inside it |          |
| Separate `ci` and `deploy` workflows  | PR checks stay isolated from promotion flow                        | yes      |
| Reusable-workflow-first decomposition | More decomposed setup from day one                                 |          |

**User's choice:** Separate `ci` and `deploy` workflows
**Notes:** The preferred outcome is a clean split between validation and promotion, while still allowing parallel jobs inside each workflow.

---

## Promotion Model

| Option                    | Description                                                                                                  | Selected |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Direct cluster deployment | GitHub Actions deploys straight to the cluster with `kubectl` or Helm                                        |          |
| GitOps-first promotion    | GitHub Actions builds and publishes artifacts, then updates repo-managed deployment inputs that ArgoCD syncs | yes      |
| Release-branch promotion  | Promotion is branch-based instead of manifest or tag-based                                                   |          |

**User's choice:** GitOps-first promotion
**Notes:** The deploy flow should extend the Phase 16 ArgoCD plus Helm model rather than bypassing it.

---

## Security Gates

| Option                                      | Description                                                                                 | Selected |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| No exceptions                               | Hard fail every HIGH and CRITICAL finding with no carve-outs                                |          |
| Hard fail with explicit reviewed exceptions | HIGH and CRITICAL findings block by default, but checked-in reviewed exceptions are allowed | yes      |
| Advisory only                               | Surface findings now and tighten later                                                      |          |

**User's choice:** Hard fail with explicit reviewed exceptions
**Notes:** Secrets and vulnerability scans should be strict, but accepted risk must remain explicit and auditable through checked-in exceptions rather than hidden workflow logic.

---

## Staging Smoke Gate

| Option                | Description                                                                      | Selected |
| --------------------- | -------------------------------------------------------------------------------- | -------- |
| Health only           | Minimal health checks before production becomes available                        |          |
| Bounded release smoke | Health, auth or session bootstrap, one protected API path, and one key web route | yes      |
| Broad browser gate    | Larger Playwright coverage before production unlocks                             |          |

**User's choice:** Bounded release smoke
**Notes:** The smoke gate should prove the staged deployment is alive and usable without duplicating the full CI or Phase 15 browser matrix.

---

## the agent's Discretion

- Exact workflow job graph, reuse strategy, and caching details
- Exact artifact registry and immutable tag format
- Exact checked-in exception file format for security tools
- Exact smoke implementation split between API and browser-level checks

## Deferred Ideas

- Direct imperative cluster deployment from GitHub Actions
- Full end-to-end suite reruns as the production promotion gate
- Broader release analytics and observability automation that belongs to Phase 18
