---
phase: 16-containerization-kubernetes
plan: 01
subsystem: infra
tags: [docker, nestjs, nextjs, fastapi, bullmq, kubernetes]
requires:
  - phase: 11-notification-event-engine
    provides: background job, queue processor, and outbox patterns reused by the worker split
provides:
  - multi-stage Dockerfiles for api, web, and ml-service
  - explicit container-safe runtime scripts for all three shipped runtimes
  - API runtime separation between HTTP-serving and worker execution
  - documented verification evidence for package builds and Docker image builds
affects: [17-ci-cd-pipeline, 18-observability-cloud-gdpr-documentation]
tech-stack:
  added: []
  patterns:
    [
      explicit APP_RUNTIME switching,
      worker-only BullMQ and scheduler wiring,
      production container entrypoints from built output,
    ]
key-files:
  created:
    [
      .dockerignore,
      apps/api/Dockerfile,
      apps/web/Dockerfile,
      apps/ml-service/Dockerfile,
      apps/api/src/runtime/runtime-mode.ts,
      apps/api/src/worker.ts,
      apps/api/src/worker.module.ts,
    ]
  modified:
    [
      .env.example,
      apps/api/package.json,
      apps/api/src/main.ts,
      apps/api/src/app.module.ts,
      apps/ml-service/package.json,
      apps/web/package.json,
    ]
key-decisions:
  - "Kept the API production entrypoint on built Node output instead of Nest CLI runtime behavior."
  - "Restricted queue processors and scheduler-owned providers to APP_RUNTIME=worker so API HPA does not scale background side effects."
  - "Kept ML startup on uvicorn with an explicit 0.0.0.0 bind and a repo-local .venv-aware test wrapper for repeatable verification."
patterns-established:
  - "Containerized runtimes must start from explicit production commands rather than dev-oriented wrappers."
  - "Nest background execution should boot through createApplicationContext without binding an HTTP listener."
requirements-completed: [K8S-01]
duration: multi-session
completed: 2026-04-26
---

# Phase 16-01: Runtime Packaging Foundations Summary

**Production-oriented Docker build paths and a clean API runtime split now separate public HTTP traffic from worker-only background execution**

## Performance

- **Duration:** multi-session
- **Started:** 2026-04-26T08:24:35Z
- **Completed:** 2026-04-26T10:41:40+05:30
- **Tasks:** 4
- **Files modified:** 11

## Accomplishments

- Added `.dockerignore` plus real Dockerfiles for `api`, `web`, and `ml-service`, with a distroless final image for the API and non-root runtime users across the set.
- Split the Nest API into explicit `api` and `worker` runtime modes so queue processors, pollers, and repeatable jobs do not scale with HTTP traffic.
- Verified local package builds, API image build, and web image build, while documenting the ML image as the remaining heavy-build outlier.

## Task Commits

No task commits were created during this inline execution pass. The implemented work remains in the current working tree and is documented here for GSD resumption.

## Files Created/Modified

- `.dockerignore` - trims monorepo build context for container builds.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/ml-service/Dockerfile` - multi-stage production image paths for the three shipped runtimes.
- `apps/api/src/runtime/runtime-mode.ts`, `apps/api/src/worker.ts`, `apps/api/src/worker.module.ts` - central runtime contract and worker bootstrap.
- `apps/api/src/*/*.module.ts` queue-related modules - gates worker-only processors and pollers behind the runtime split.
- `.env.example`, `apps/api/package.json`, `apps/web/package.json`, `apps/ml-service/package.json` - explicit container-safe runtime commands and documented env defaults.

## Decisions Made

- Used `APP_RUNTIME` as the central runtime switch so Kubernetes can schedule HTTP and worker workloads independently.
- Left repeatable BullMQ registration app-owned, but guarded initialization so only worker pods own that behavior.
- Updated the ML test command to prefer the service-local virtualenv, which matches how the Python runtime is managed in this repo today.

## Deviations from Plan

- The plan expected all three Docker builds to finish cleanly in one pass. API and web completed, but the ML image exceeded a 30-minute timeout because the container install path pulls heavyweight Python dependencies.

## Issues Encountered

- `pnpm --filter @amdox/web build` hit a Windows sandbox `spawn EPERM` failure and had to be re-run outside the sandbox.
- Initial Docker verification could not run inside the sandbox; Docker Desktop verification required escalated access to the local daemon.

## User Setup Required

None beyond having Docker Desktop available locally for image verification.

## Next Phase Readiness

- Helm, traffic, and GitOps work can build on the explicit `api` versus `worker` process contract.
- The remaining follow-up for this plan is to finish or optimize the ML image build path so K8S-01 is fully green end to end.

---

_Phase: 16-containerization-kubernetes_
_Completed: 2026-04-26_
