# Phase 16: Containerization & Kubernetes - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the existing ERP application for production-style containerized deployment by creating hardened Docker images, a Helm chart for the application workloads and their Kubernetes resources, an Istio canary configuration, and ArgoCD GitOps manifests.

This phase turns the already-built app stack into a deployable Kubernetes shape. It does not move CI/CD ownership forward from Phase 17, provision AWS infrastructure from Phase 18, or expand the Phase 16 Helm scope into owning full stateful platform infrastructure such as databases, Redis, Keycloak, or Elasticsearch clusters.

</domain>

<decisions>
## Implementation Decisions

### Chart Boundary

- **D-01:** The Phase 16 Helm chart should deploy application workloads only: `web`, `api`, `ml-service`, and the Kubernetes resources required to run them.
- **D-02:** Postgres, Redis, Keycloak, Elasticsearch, and object storage should be treated as external dependencies rather than in-cluster chart-owned services.
- **D-03:** External dependencies should be modeled as managed-style endpoints supplied through Helm values and Kubernetes secret references.

### Traffic Model

- **D-04:** Production traffic should use split public hostnames rather than a single shared hostname.
- **D-05:** `web` should be exposed on the main application domain, `api` on its own API domain, and auth/admin traffic on a separate auth domain.
- **D-06:** The required Istio `90/10` canary should target the `api` service first; `web` remains stable initially and `ml-service` stays internal-only.

### Secrets And Config

- **D-07:** GitOps manifests must never contain real secret material; they should use Kubernetes `Secret` references and placeholder values only.
- **D-08:** Phase 16 should not pretend secret-manager integration is solved yet; it should leave a clean placeholder contract that later phases can wire to a stronger source of truth.
- **D-09:** Helm configuration should use one shared base values layer plus explicit environment overlays for `dev`, `staging`, and `prod`.

### Workload Split

- **D-10:** Background processing should run in dedicated worker workloads separate from the HTTP-serving `api` deployment.
- **D-11:** The Kubernetes workload model should preserve the existing BullMQ-oriented background architecture instead of collapsing everything into the request-serving API pods.
- **D-12:** Kubernetes `CronJob` resources should be used only for truly cluster-scheduled tasks, while queue-driven repeatable work stays in worker-owned BullMQ flows.

### GitOps Shape

- **D-13:** Phase 16 should establish an app-of-apps ArgoCD structure with a root application pointing to environment-specific child applications.
- **D-14:** Sync ordering should be deliberate: shared config and dependency contracts first, then application services, then traffic-layer resources such as Istio and ingress.
- **D-15:** The GitOps layout should be shaped so that Phase 17 CI/CD and Phase 18 cloud-environment work can extend it without having to redesign the repository structure.

### the agent's Discretion

- Exact container base images, multi-stage layout details, and runtime hardening steps for each workload, so long as the roadmap constraints remain intact: API distroless, web alpine-class runtime, ML Python slim, non-root, and no shell where required
- Exact Deployment/Service/HPA/PDB/NetworkPolicy object breakdown per workload
- Exact ArgoCD child-application folder structure and naming, so long as the root app plus environment-child pattern is preserved
- Exact Secret names, ConfigMap layout, and values-file organization, so long as secrets stay out of git and environment overlays remain explicit
- Exact handling of cluster-scheduled jobs vs always-on workers for specific job types, so long as BullMQ-owned repeatable work is not re-platformed wholesale into native K8s cron

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and platform constraints

- `.planning/ROADMAP.md` - Phase 16 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `K8S-01` through `K8S-04`, plus upstream security, testing, and deployment constraints that must remain true in containerized form
- `.planning/PROJECT.md` - locked stack direction for Docker, Kubernetes, Helm, Istio, ArgoCD, AWS, and zero-hardcoded-secrets expectations
- `.planning/STATE.md` - current execution state and carry-forward notes from earlier phases
- `.planning/research/STACK.md` - project-wide stack recommendation that already locks Kubernetes + Helm + Istio + ArgoCD as the target orchestration shape

### Prior phase context that constrains Phase 16

- `.planning/phases/01-environment-setup-monorepo-scaffold/01-CONTEXT.md` - root monorepo layout and the earlier decision that `docker-compose.yml` is for local backing services only
- `.planning/phases/08-ai-ml-demand-forecasting/08-CONTEXT.md` - FastAPI ML service boundary and the external service contract the chart must preserve
- `.planning/phases/11-notification-event-engine/11-CONTEXT.md` - queue-backed background-delivery pattern and 5-second outbox polling that the worker topology must package correctly
- `apps/api/src/common/security/security-headers.ts` - current header hardening baseline and security posture that container and ingress config must not weaken
- `apps/api/package.json` and `apps/web/package.json` - currently shipped API/web runtime scripts that define the deployment entrypoint starting point

The current workspace snapshot does not contain local phase directories for 12 through 15, so Phase 16 planning should treat the roadmap, requirements, project constraints, and confirmed source files as the authoritative upstream inputs for frontend, API, security, and testing expectations.

### Existing runtime seams to containerize

- `docker-compose.yml` - current dependency inventory, service names, ports, and local backing-service assumptions
- `.env.example` - current environment-variable contract for app ports, external dependencies, auth, Redis, ML, mail, BI artifacts, and observability endpoints
- `apps/api/package.json` - API build/start/test scripts that drive the production image entrypoint and build stages
- `apps/api/src/main.ts` - API bootstrap, port binding, cluster-worker behavior, versioned `/api/v1` prefix, and CORS/runtime assumptions
- `apps/api/src/health/health.controller.ts` - API health probe contract
- `apps/web/package.json` - web build/start scripts and Next runtime contract
- `apps/web/src/middleware.ts` - auth-gated routing behavior the web deployment must preserve
- `apps/ml-service/requirements.txt` - ML image dependency baseline
- `apps/ml-service/main.py` - ML service process shape and `/health` endpoint contract

### Existing external dependency touchpoints

- `infra/keycloak/amdox-realm.json` - Keycloak realm baseline that confirms auth remains an external platform dependency in this phase
- `infra/db/init.sql` - database bootstrap artifact that reinforces the current external-db contract
- `apps/api/src/auth/auth.service.ts` - Redis- and Keycloak-backed auth runtime dependencies
- `apps/api/src/auth/strategies/jwt.strategy.ts` - JWKS/issuer dependency on external Keycloak
- `apps/api/src/ap-ar/ap-ar.module.ts` - Redis-backed queue/runtime dependency seam
- `apps/api/src/finance/fx-rates.service.ts` - Redis dependency used from API runtime
- `apps/api/src/ap-ar/storage/invoice-storage.service.ts` - object storage dependency seam
- `apps/api/src/payroll/storage/payslip-storage.service.ts` - object storage dependency seam
- `apps/api/src/bi/reports/bi-report-storage.service.ts` - object storage/report artifact dependency seam

No separate infrastructure ADR exists yet for Phase 16 - the decisions above and these references are the authoritative planning inputs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `docker-compose.yml` already documents the current backing-service inventory and port conventions, which can seed external service values and environment contracts.
- `apps/api/src/main.ts` already binds on `0.0.0.0`, uses an env-driven port, and exposes a clean versioned API bootstrap, making it a straightforward container entrypoint.
- `apps/api/src/health/health.controller.ts` already exposes a simple public health endpoint suitable for Kubernetes probes.
- `apps/ml-service/main.py` already exposes `/health` and has a single-process FastAPI shape suited to a slim service container.
- `apps/api/package.json`, `apps/web/package.json`, and `apps/ml-service/requirements.txt` already define the build/runtime seams each Dockerfile needs to honor.

### Established Patterns

- The repo currently treats stateful infrastructure as separate from application runtimes: local backing services live in `docker-compose.yml`, while application services run from workspace scripts.
- Security work from Phase 14 already locked the expectation that secrets do not live in repo-managed config, so GitOps artifacts must reference secrets rather than embed them.
- Background scheduling and async work already lean on BullMQ and Redis-backed application logic, so Phase 16 should package that pattern rather than replace it with a different job platform by default.
- The API, web, and ML services already have distinct process/runtime contracts, which supports separate workloads and a split-hostname ingress model.

### Integration Points

- Helm values and Secrets need to feed the existing `.env.example` contract rather than invent a second configuration model.
- Kubernetes probes, Services, and ingress routes need to align with the API `/api/v1/health` seam, ML `/health`, and the web runtime's Next.js startup contract.
- Worker workloads need to reuse the same application code and external dependencies as the API while running different entry commands and scaling policies.
- ArgoCD sync ordering must account for shared config/Secrets first, service deployments second, and Istio/ingress traffic resources last.

</code_context>

<specifics>
## Specific Ideas

- Treat Phase 16 as "production packaging for the app tier," not as "run the whole platform inside Kubernetes."
- Keep the first canary story simple and auditable by shifting API traffic 90/10 before expanding progressive delivery to every public surface.
- Make the GitOps contract honest: commit placeholders and references, not fake secret values or premature secret-manager lock-in.
- Preserve the existing BullMQ-centric background architecture, but give it proper operational separation from request-serving API pods.

</specifics>

<deferred>
## Deferred Ideas

- Running Postgres, Redis, Keycloak, Elasticsearch, or object storage as chart-owned in-cluster services in Phase 16
- Expanding progressive delivery to every public workload from day one
- Solving full external secret-manager integration in this phase
- Pulling CI/CD pipeline orchestration forward from Phase 17
- Pulling AWS/EKS/Terraform environment provisioning forward from Phase 18

</deferred>

---

*Phase: 16-containerization-kubernetes*
*Context gathered: 2026-04-26*
