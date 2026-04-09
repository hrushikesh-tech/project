# Phase 1: Environment Setup & Monorepo Scaffold - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the Turborepo monorepo, code quality toolchain, and Docker Compose development stack so all subsequent phases have a consistent foundation.

</domain>

<decisions>
## Implementation Decisions

### Repository Structure

- **D-01:** Scaffold directly in the root, moving current legacy code (`frontend/` and `backend/`) to a `legacy/` folder for reference. Turborepo manages the new `apps/` and `packages/` directories.

### Docker Compose Architecture

- **D-02:** Use a single `docker-compose.yml` at the root for backing services only (TimescaleDB, Redis, Keycloak, Elasticsearch, Mailpit). The application services (Next/Nest/FastAPI) are run via `pnpm dev`.

### Linting & Rule Strictness

- **D-03:** Apply strict TypeScript and recommended ESLint rules universally from day one.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Environment Setup

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Legacy `frontend/` and `backend/` directories exist but will be moved to `legacy/` rather than reused directly.

### Established Patterns

- We are establishing new patterns with Turborepo, Next.js 15, and NestJS 11. None to inherit.

### Integration Points

- Root directory will be the entry point for `pnpm` workspaces encompassing `apps/` and `packages/`.
  </code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 01-Environment Setup & Monorepo Scaffold_
_Context gathered: 2026-04-09_
