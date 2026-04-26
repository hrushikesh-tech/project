# Phase 13: API Gateway, GraphQL & Webhooks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `13-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-23T23:34:29.2718491+05:30
**Phase:** 13-api-gateway-graphql-webhooks
**Areas discussed:** API standardization scope, GraphQL BI shape, Webhook boundary, API docs exposure

---

## API Standardization Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Retrofit all existing REST modules | Centralized versioning, uniform envelope, and OpenAPI coverage across the current Nest API surface | yes |
| Standardize only the most integration-facing modules | Clean up BI, Notifications, Auth, and a narrow subset now | |
| Docs/versioning global, envelope only for touched endpoints | Partial retrofit with uneven payload normalization | |

**User's choice:** Retrofit all existing REST modules.
**Notes:** Phase 13 should act as full API-platform consolidation rather than a narrow or partial standardization pass.

---

## GraphQL BI Shape

| Option | Description | Selected |
|--------|-------------|----------|
| BI-read-only metric-centric GraphQL plus dashboard helpers | Metrics are first-class; dashboard read helpers are layered on top | yes |
| Dashboard-centric GraphQL only | GraphQL reads dashboards/widgets/results but not direct BI metrics | |
| Broad multi-domain GraphQL layer | Expand GraphQL beyond BI into the wider ERP | |

**User's choice:** BI-read-only metric-centric GraphQL plus dashboard helpers.
**Notes:** GraphQL should stay intentionally narrow and should not become a second general ERP API surface in this phase.

---

## Webhook Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Phase 11 webhook engine and standardize/document it | Reuse the existing notification/event-delivery webhook behavior | yes |
| Expand into a broader outbound integration webhook platform | Add wider subscription/event-management behavior in Phase 13 | |
| Leave webhook work mostly in Phase 11 | Focus Phase 13 almost entirely on OpenAPI, envelopes, and GraphQL | |

**User's choice:** Keep the Phase 11 webhook engine and standardize/document it.
**Notes:** Phase 13 should not create a second webhook product or duplicate delivery behavior that already exists in notifications.

---

## API Docs Exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Internal/developer surface | Available in dev and staging, optionally protected in production | yes |
| Production-available for tenant admins/integration teams | Treated as a wider tenant-facing integration surface | |
| Non-production only | Never available in production | |

**User's choice:** Internal/developer surface.
**Notes:** `/api-docs` should support engineering and internal integration work, not become a public product surface.

---

## the agent's Discretion

- Exact response envelope field naming and interceptor implementation
- Exact GraphQL schema organization and DataLoader boundaries
- Exact `/api-docs` production gating mechanism

## Deferred Ideas

- Broader webhook productization beyond notification/event delivery
- ERP-wide GraphQL beyond BI-read use cases
- Public API-docs product surface for tenants
