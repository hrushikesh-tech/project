# Phase 13: API Gateway, GraphQL & Webhooks - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize the existing NestJS API surface with centralized REST versioning, OpenAPI 3.1 documentation, and a consistent response envelope, then add a BI-focused GraphQL read layer for aggregation queries.

This phase formalizes and unifies the API contract across the current backend modules. It does not create a second webhook product beside the Phase 11 notification engine, expand GraphQL into a general ERP write API, or broaden scope into Phase 14 security hardening.

</domain>

<decisions>
## Implementation Decisions

### REST Standardization Scope

- **D-01:** Phase 13 should retrofit the current REST API surface to a shared contract rather than standardizing only a subset of modules.
- **D-02:** Versioning should become centralized platform behavior instead of remaining hardcoded independently in controller route prefixes.
- **D-03:** All current REST endpoints should participate in the standard response envelope and OpenAPI coverage once this phase is complete.

### GraphQL BI Shape

- **D-04:** GraphQL in Phase 13 is BI-read-only.
- **D-05:** The GraphQL surface should be metric-centric first, with dashboard read helpers layered on top where needed.
- **D-06:** Phase 13 must not expand GraphQL into a broad multi-domain ERP API beyond BI aggregation queries.

### Webhook Boundary

- **D-07:** The existing Phase 11 notification webhook engine remains the system's outbound webhook foundation.
- **D-08:** Phase 13 should standardize and document that webhook contract rather than inventing a separate webhook product or duplicating delivery behavior.
- **D-09:** Any broader external integration platform behavior beyond the current notification/event-delivery scope is deferred out of this phase.

### API Documentation Exposure

- **D-10:** `/api-docs` is a developer and internal integration surface.
- **D-11:** `/api-docs` should be available in development and staging by default.
- **D-12:** Production exposure, if allowed, should remain protected and treated as an internal integration tool rather than a public tenant-facing portal.

### Response Contract Expectations

- **D-13:** The standardized REST contract must add a consistent envelope with request identifiers, timestamps, and pagination metadata where relevant.
- **D-14:** Envelope standardization should preserve existing tenant-safe business semantics while normalizing transport shape across modules.

### the agent's Discretion

- Exact envelope field names and interceptor/serializer split, as long as request ID, timestamp, and pagination metadata are present consistently.
- Exact NestJS module layout for the API platform layer, GraphQL resolver organization, and DataLoader boundaries.
- Exact OpenAPI annotation strategy and grouping of tags, so long as the full current API surface is documented.
- Exact production gating mechanism for `/api-docs`, introspection disabling, persisted-query plumbing, and GraphQL limits, so long as the locked exposure and BI-only decisions are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 13 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `API-01` through `API-05`, plus nearby security constraints that shape introspection and API-surface handling
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable product boundaries
- `.planning/STATE.md` - current project execution state and carry-forward notes from completed phases

### Prior phase context that constrains Phase 13

- `.planning/phases/09-business-intelligence-dashboard/09-CONTEXT.md` - locked BI metric contracts, dashboard semantics, SSE refresh behavior, and scheduled-report constraints that GraphQL must respect
- `.planning/phases/11-notification-event-engine/11-CONTEXT.md` - locked notification/webhook delivery semantics and the explicit boundary that broader webhook-product behavior was deferred to Phase 13
- `.planning/phases/12-frontend-next-js-15/12-CONTEXT.md` - frontend expectations around BI data access, auth/session behavior, and role-aware API consumption that the standardized API surface should not break

### Existing API platform seams

- `apps/api/src/main.ts` - current Nest bootstrap, global validation, and absence of centralized versioning/OpenAPI setup
- `apps/api/src/app.module.ts` - current global guards/interceptor registration and module wiring
- `apps/api/src/common/interceptors/audit.interceptor.ts` - existing cross-cutting interceptor pattern already applied globally
- `.planning/codebase/ARCHITECTURE.md` - backend module/request-flow guidance and current API structure
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, and service-layer conventions
- `.planning/codebase/STRUCTURE.md` - monorepo/package structure and current API package layout

### Existing BI and GraphQL-adjacent source contracts

- `apps/api/src/bi/bi.controller.ts` - current BI REST surface under `/api/v1/bi`
- `apps/api/src/bi/bi.service.ts` - current dashboard/widget/data orchestration behavior
- `apps/api/src/bi/metrics/bi-metrics.service.ts` - existing BI aggregation logic that GraphQL should reuse rather than duplicate semantically
- `packages/types/src/bi.ts` - locked BI metric keys, filters, and result contracts available to both REST and GraphQL planning

### Existing notification and webhook source contracts

- `apps/api/src/notifications/notifications.controller.ts` - current notification and webhook-management REST surface
- `apps/api/src/notifications/notification-delivery.service.ts` - event-delivery orchestration and webhook dispatch boundary
- `apps/api/src/notifications/channels/webhook-channel.service.ts` - existing HMAC-signed webhook delivery behavior that Phase 13 must standardize/document, not replace
- `packages/types/src/notifications.ts` - shared notification and webhook-facing types

### Shared schema and persistence contracts

- `packages/db/prisma/schema.prisma` - current persisted models for dashboards, widgets, outbox events, webhook configs, notifications, and audit logs
- `packages/db/src/index.ts` - exported Prisma surface available to the API layer
- `packages/types/src/index.ts` - shared cross-domain type export surface

No separate external API ADRs or GraphQL specs exist yet - the phase requirements are fully captured by the references above plus the decisions in this context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/api/src/common/interceptors/audit.interceptor.ts` already establishes a global interceptor seam that can inform envelope-standardization placement.
- `apps/api/src/bi/bi.service.ts` and `apps/api/src/bi/metrics/bi-metrics.service.ts` already contain the BI read logic that a GraphQL layer should wrap instead of re-implementing with different semantics.
- `apps/api/src/notifications/notification-delivery.service.ts` and `apps/api/src/notifications/channels/webhook-channel.service.ts` already provide working outbound webhook behavior, HMAC signing, and retry-aware delivery patterns.
- `packages/types/src/bi.ts` already defines BI metric/filter/result contracts that can anchor GraphQL schema design and reduce contract drift.

### Established Patterns

- API capabilities are organized as vertical NestJS modules with thin controllers and service-heavy orchestration.
- DTO validation is handled globally through Nest validation pipes, so platform standardization should preserve that pattern rather than replacing it.
- Current routes are versioned inline at controller level using `/api/v1/...`, which indicates standardization should centralize an already-adopted convention rather than introduce a brand-new API shape.
- Webhooks are currently an outbound notification/event-delivery concern, not a standalone integration platform.

### Integration Points

- Phase 13 will need to touch bootstrap/platform code in `apps/api/src/main.ts` and possibly shared API-platform infrastructure under `apps/api/src/common`.
- REST standardization must span existing domain modules including auth, finance, AP/AR, HR, payroll, supply chain, BI, project management, and notifications without breaking their tenant-safe business logic.
- GraphQL should integrate primarily with the BI module and its existing metric services, then expose dashboard read helpers that align with current dashboard/widget models.
- Webhook standardization should attach to the current notifications module and delivery path, not a new parallel delivery system.

</code_context>

<specifics>
## Specific Ideas

- Treat this as API-platform consolidation work, not a feature rewrite of individual business modules.
- Keep GraphQL intentionally narrow and read-only so BI aggregation gets a better integration surface without creating a second general-purpose backend contract.
- Use the existing webhook implementation as the canonical outbound event path and make it cleaner to consume and document.
- Treat `/api-docs` as an engineering and internal integration tool, not a public product surface.

</specifics>

<deferred>
## Deferred Ideas

- A broader integration webhook product with standalone subscription/event management beyond the current notification engine
- Cross-domain GraphQL writes or a full ERP-wide GraphQL API
- Public or tenant-self-service production API docs exposure as a product feature

</deferred>

---

*Phase: 13-api-gateway-graphql-webhooks*
*Context gathered: 2026-04-23*
