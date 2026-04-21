# Phase 11: Notification & Event Engine - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend notification and event-delivery engine for the ERP: poll durable outbox records, dispatch notifications across in-app, email, SMS, and webhook channels, enforce webhook signing, apply tenant/user preference rules, and support tenant-overridable notification templates.

This phase turns the earlier bridge pattern into a real delivery system. It does not add frontend notification-center UX, external provider dashboards, or broad API-gateway/webhook-product features beyond the tenant-scoped notification engine required by `NOTIF-01` through `NOTIF-06`.

</domain>

<decisions>
## Implementation Decisions

### Preference Defaults and Evaluation

- **D-01:** Supported notification channels start enabled by default for supported event types, and users opt out per event type and channel.
- **D-02:** `NotificationPreference` rows therefore act as overrides to the default-on behavior rather than as required opt-in records.
- **D-03:** Preference evaluation should stay user-scoped and tenant-scoped, using the existing unique key on `(tenantId, userId, eventType, channel)`.

### Template Strategy

- **D-04:** Phase 11 should ship platform default templates for every supported event/channel combination.
- **D-05:** Tenants may override templates selectively; they do not need to define every template before delivery can work.
- **D-06:** Template resolution should prefer tenant override first, then fall back to the platform default for the same event/channel.

### Delivery and Retry Semantics

- **D-07:** Failed deliveries should retry with bounded backoff rather than retrying forever or failing permanently after one attempt.
- **D-08:** After the bounded retry policy is exhausted, delivery must settle into a durable failed state that operators and downstream tooling can inspect.
- **D-09:** Outbox polling remains the guaranteed-delivery handoff boundary, and Phase 11 should implement the roadmap expectation that pending events are picked up within 5 seconds.

### Webhook Behavior

- **D-10:** Webhook delivery is broadcast-style: every active tenant webhook endpoint subscribed to an event should receive that event.
- **D-11:** Webhook verification must use HMAC-SHA256 signing and timing-safe comparison.
- **D-12:** Phase 11 webhook behavior remains tenant-scoped notification delivery, not the broader external webhook product surface deferred to Phase 13.

### Event Catalog Scope

- **D-13:** Phase 11 must fully wire the delivery engine for events already emitted by completed phases.
- **D-14:** Phase 11 should also seed the broader 20+ event catalog structure, templates, and preference support for the rest of the roadmap event surface even when some producers arrive later.
- **D-15:** The broader catalog should be implementation-ready rather than requiring every future producer to be built in this phase.

### SMS Boundary

- **D-16:** SMS is a first-class Phase 11 channel in preferences, templates, and worker routing.
- **D-17:** Actual SMS sending is configuration-gated in this phase.
- **D-18:** When no SMS provider is configured, SMS delivery should leave durable skipped or failed delivery evidence rather than pretending success or removing SMS from the system model.

### the agent's Discretion

- Exact queue topology, worker split, and module/service layout for outbox polling, delivery fan-out, and per-channel dispatch
- Exact retry schedule and terminal-state naming, as long as retries are bounded and final failure is durable
- Exact storage shape for delivery-attempt metadata, as long as operators can inspect processed, skipped, retried, and failed outcomes
- Exact built-in event catalog composition beyond the already-emitted event types, as long as the seeded structure clearly supports the roadmap's 20+ event expectation
- Exact provider seams for email, SMS, and webhook dispatch, as long as they stay configuration-driven and testable in the current repo

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 11 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `NOTIF-01` through `NOTIF-06`, plus retention guidance from `GDPR-04`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable constraints
- `.planning/STATE.md` - current execution state and carry-forward notes from completed phases

### Prior phase context that constrains Notification & Event Engine

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - hybrid enum strategy and notification-channel schema decisions
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - mismatch events and lightweight in-app notification bridge pattern
- `.planning/phases/05-hr-core/05-CONTEXT.md` - rejection notification bridge and background-job conventions
- `.planning/phases/09-business-intelligence-dashboard/09-CONTEXT.md` - scheduled report email delivery plus durable outbox/notification behavior
- `.planning/phases/10-project-management/10-CONTEXT.md` - budget overrun alert behavior and durable event-first notification expectations

### Existing data model and shared enums

- `packages/db/prisma/schema.prisma` - existing `Notification`, `OutboxEvent`, `NotificationPreference`, `WebhookConfig`, and `NotificationTemplate` models
- `packages/db/src/index.ts` - exported Prisma surface and `NotificationChannel`
- `packages/types/src/enums.ts` - shared `OutboxEventStatus` and other cross-module enum conventions

### Existing backend patterns and delivery seams

- `apps/api/src/app.module.ts` - current module registration and global guard/interceptor setup
- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit `forTenant()` background-operation pattern
- `apps/api/src/ap-ar/ap-ar.service.ts` - existing producer pattern for `invoice.match_failed` outbox and in-app notifications
- `apps/api/src/hr/hr.service.ts` - existing producer pattern for `hr.leave.rejected`
- `apps/api/src/bi/reports/bi-report.service.ts` - existing producer pattern for `bi.report.ready` plus report-delivery outcomes
- `apps/api/src/bi/reports/bi-report-mailer.service.ts` - current SMTP/Mailpit-compatible email-delivery seam
- `apps/api/src/project-management/project-budget-alert.service.ts` - existing producer pattern for `project.budget.overrun`
- `apps/api/src/bi/queue/bi-report.queue.ts` - repeatable-job registration pattern
- `apps/api/src/forecasting/queue/forecasting.queue.ts` - tenant-scoped repeatable BullMQ worker pattern
- `apps/api/src/payroll/queue/payroll.queue.ts` - single-run BullMQ enqueue pattern
- `apps/api/src/common/schedule/schedule.ts` - shared cron-expression helper surface

### Architecture and roadmap references

- `.planning/research/ARCHITECTURE.md` - outbox-worker to notification-worker event-flow expectation, including 5-second polling
- `.planning/codebase/ARCHITECTURE.md` - backend module and request-flow guidance
- `.planning/codebase/CONVENTIONS.md` - tenant scoping, validation, and service-layer business-rule conventions
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

No separate external notification ADRs or provider-specific specs exist yet - the notification requirements are fully captured by the references above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma`: notification, outbox, preference, webhook-config, and template tables already exist, so Phase 11 should build behavior on top of the current schema rather than inventing a parallel storage model.
- `apps/api/src/bi/reports/bi-report-mailer.service.ts`: already provides a Mailpit-friendly SMTP seam that Phase 11 can generalize or reuse for email-channel delivery.
- `apps/api/src/*/queue/*.ts`: payroll, forecasting, and BI already establish BullMQ patterns for both repeatable and one-off job dispatch.
- `apps/api/src/ap-ar/ap-ar.service.ts`, `apps/api/src/hr/hr.service.ts`, `apps/api/src/bi/reports/bi-report.service.ts`, and `apps/api/src/project-management/project-budget-alert.service.ts`: already emit real outbox events and in-app notification rows that Phase 11 must consume.

### Established Patterns

- Cross-module business flows already persist durable `OutboxEvent` records and lightweight `Notification` rows before the full engine exists.
- Background and scheduled work uses BullMQ with explicit tenant IDs instead of request CLS.
- Backend capabilities land as vertical NestJS modules with thin controllers and service-heavy business logic.
- Delivery behavior must stay tenant-scoped and configuration-driven, with clear durable state rather than silent best-effort outcomes.

### Integration Points

- Phase 11 should land as a new backend module under `apps/api/src/notifications` or an equivalently clear vertical slice.
- The outbox worker needs to read existing `PENDING` events from prior modules and route them into channel-specific delivery without changing producer contracts.
- Email delivery should reuse or evolve the existing SMTP seam rather than introducing an unrelated mail stack.
- Webhook delivery should attach to tenant `WebhookConfig` subscriptions and sign payloads consistently across producers.
- Preference and template resolution must sit in the delivery path so earlier modules can keep emitting domain events without per-module notification logic.

</code_context>

<specifics>
## Specific Ideas

- Keep the earlier phases' bridge producers intact; Phase 11 should consume and enrich them rather than forcing upstream modules to rewrite event creation.
- Treat defaults as product behavior: notifications are on unless a user or tenant explicitly turns a channel off for an event.
- Use platform-default templates so the engine is useful immediately, then allow tenant overrides for branding or wording changes.
- Make SMS structurally real now even if a live provider is not configured in every environment.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

_Phase: 11-notification-event-engine_
_Context gathered: 2026-04-21_
