# Phase 11: Notification & Event Engine - Research

**Date:** 2026-04-21
**Phase:** 11-notification-event-engine
**Status:** Complete

## What This Phase Needs To Solve

Phase 11 has to turn the existing notification bridge into a real cross-cutting delivery engine that:

- picks up durable `OutboxEvent` rows within 5 seconds of commit
- dispatches event-driven notifications across in-app, email, SMS, and webhook channels
- applies default-on per-event, per-channel preference filtering without requiring opt-in rows
- resolves tenant template overrides against platform defaults
- signs webhook payloads with HMAC-SHA256 and uses timing-safe signature verification helpers
- supports the completed-phase event types already emitted by AP/AR, HR, Payroll, Supply Chain, BI, and Project Management

The core design tension is that the schema and several modules already write `OutboxEvent` and lightweight in-app `Notification` rows, but there is no delivery engine yet. Phase 11 therefore must consume and enrich existing producers without forcing Phases 4, 5, 6, 7, 9, and 10 to rewrite how they emit domain events.

## Codebase Findings

### Existing assets that Phase 11 should reuse

- `packages/db/prisma/schema.prisma` already defines `Notification`, `OutboxEvent`, `NotificationPreference`, `WebhookConfig`, and `NotificationTemplate`, so Phase 11 should build on the current data model rather than inventing a parallel notification store.
- `packages/db/prisma/schema.prisma` also defines `NotificationChannel` as a stable Prisma enum, which matches the Phase 2 decision that channels are stable schema-level values.
- `apps/api/src/bi/reports/bi-report-mailer.service.ts` already provides a low-dependency SMTP/Mailpit-compatible email seam that Phase 11 can reuse or generalize.
- The repo already uses BullMQ heavily through `apps/api/src/*/queue/*.ts` and `@nestjs/bullmq` processors, so a notification queue and processor fit the established worker model.
- `apps/api/src/common/schedule/schedule.ts` already centralizes cron-expression constants, and `@nestjs/schedule` is already installed in `apps/api`.
- Existing producers already emit durable event types:
  - `invoice.match_failed`
  - `hr.leave.rejected`
  - `payroll.run.completed`
  - `payroll.run.failed`
  - `supply-chain.reorder.skipped`
  - `bi.report.ready`
  - `project.budget.overrun`

### Important constraints and gaps

- `Notification` is user-bound (`userId` required), which makes it suitable for in-app delivery evidence but not a complete ledger for email, SMS, or webhook outcomes.
- `NotificationTemplate` currently requires `tenantId`, which means truly global platform defaults are better represented in code or seeded under a known internal convention rather than as anonymous database rows.
- Existing bridge flows already create in-app `Notification` rows upstream. If Phase 11 blindly creates new in-app notifications for those same events, it will duplicate user-visible records.
- `OutboxEvent` currently has `status`, `processedAt`, and `retryCount`, but it does not yet expose a full retry-scheduling or per-channel result surface.
- There is no notification module yet in `apps/api/src`, so there is no owner for preference CRUD, webhook-config CRUD, template override CRUD, inbox reads, or outbox processing.
- No current helper centralizes event-type definitions, recipient resolution rules, or template-variable contracts for notification events.

## Recommended Technical Direction

### 1. Keep Notification & Events as a backend-owned vertical slice

Phase 11 should land as a dedicated module such as `apps/api/src/notifications` with:

- `notifications.module.ts`
- `notifications.controller.ts`
- notification DTOs and serialization helpers
- `notifications.service.ts` for inbox, preferences, templates, and webhook-config APIs
- `outbox-poller.service.ts`
- `notification-delivery.service.ts`
- per-channel helpers (`in-app`, `email`, `webhook`, `sms`)
- BullMQ queue + processor files for delivery work

This matches the repo's existing NestJS module structure and keeps delivery behavior out of individual domain modules.

### 2. Keep existing producers intact and make Phase 11 consume them

The earlier phases already satisfy their own user-facing obligations by writing:

- `OutboxEvent` rows for durable event traces
- lightweight in-app `Notification` rows for immediate visibility

Phase 11 should not force those modules to stop doing that. The engine should instead:

- consume their existing `OutboxEvent` rows
- treat in-app delivery idempotently for legacy event types
- add richer channel delivery (email, webhook, SMS) around the existing bridge pattern

This preserves backward compatibility while still letting Phase 11 become the true delivery layer.

### 3. Use a code-owned event catalog rather than a schema-owned catalog

The completed phases already emit concrete event-type strings, and Phase 11 must also seed a broader 20+ event catalog. The cleanest implementation is a code-owned catalog that defines, per event type:

- supported channels
- recipient-resolution strategy
- template-variable builder
- whether legacy in-app rows already exist upstream
- subject/title/body default templates

This avoids another schema migration and fits the user's decision that platform defaults exist even when tenants do not override them.

### 4. Treat tenant template rows as overrides, not the source of truth

Because `NotificationTemplate` is tenant-scoped in the current schema, the best practical template model is:

- platform defaults live in code constants or code-adjacent template assets
- tenant overrides stay in `NotificationTemplate`
- runtime resolution is: tenant override first, then platform default

This exactly matches the locked decision and avoids inventing a fake global tenant.

### 5. Extend outbox bookkeeping just enough for retry and operator visibility

Phase 11 needs bounded retries and durable failed or skipped outcomes. The most useful minimal extension is:

- keep `OutboxEvent` as the delivery source of truth
- add scheduling/error/result metadata needed for bounded retry
- record per-event delivery summary in a durable machine-readable shape

The planner can choose whether that is:

- extra fields directly on `OutboxEvent`
- or a narrow supporting result record

Either approach is acceptable, but the phase must make retry state and terminal failure inspectable.

### 6. Poll outbox on a fixed 5-second cadence, then hand off to BullMQ

The cleanest design consistent with the repo is:

- a scheduled poller runs every 5 seconds
- it selects eligible pending outbox rows and claims a small batch
- it enqueues delivery jobs onto a notification queue
- the BullMQ processor handles channel resolution and delivery attempts
- the processor updates outbox retry state and final status

This uses the roadmap's 5-second expectation while still fitting the worker architecture already used in other phases.

### 7. Separate recipient resolution from payload delivery

Several existing outbox payloads do not include final recipients for every channel. For example:

- AP/AR mismatch events include invoice and mismatch details, not universal email recipients
- BI report events include email recipients directly
- HR and Project events can derive user recipients from employee relationships and tenant-admin lookups

The worker therefore needs an event-specific recipient-resolution layer. That logic belongs in the event catalog or a companion resolver service, not hard-coded inside each channel transport.

### 8. Keep SMS structurally real but config-gated

The codebase has no SMS provider today, and the user explicitly chose config-gated SMS. The most phase-appropriate implementation is:

- SMS channel exists in the event catalog, preferences, and template resolution
- SMS transport is behind environment configuration
- when provider config is absent, the delivery path records a durable skipped or failed result

This keeps Phase 11 aligned with the roadmap without inventing fake provider success.

### 9. Use Node-native crypto and fetch for webhook delivery

The repo already uses Node-native `fetch`, and there is no need to introduce a custom webhook client stack. Webhook delivery should use:

- `createHmac("sha256", secret)` for signature creation
- `timingSafeEqual` in the shared verification helper
- standard `fetch` for outbound HTTP delivery

This keeps dependencies light and consistent with the repo's current style.

## Event Types The Planner Should Treat As First-Class In Phase 11

At minimum, the Phase 11 delivery engine should fully support the completed-phase events already emitted today:

- `invoice.match_failed`
- `hr.leave.rejected`
- `payroll.run.completed`
- `payroll.run.failed`
- `supply-chain.reorder.skipped`
- `bi.report.ready`
- `project.budget.overrun`

The broader seeded catalog for future roadmap phases should also reserve notification-template and preference coverage for expected event families such as:

- invoice review and posting events
- PO lifecycle and inventory alerts
- payroll admin and employee events
- HR workflow events
- project and milestone events
- forecast model and quality events
- account and user lifecycle events

## Risks And Planning Traps

### 1. Duplicating legacy in-app notifications

If the worker creates new in-app `Notification` rows for every already-emitted event without understanding the bridge pattern, users will receive duplicate inbox entries for AP/AR, HR, BI, payroll, and project alerts.

### 2. Treating preferences as opt-in

If the implementation assumes a preference row must exist before delivery, the system will silently disable most channels and contradict the user's default-on decision.

### 3. Overreaching into Phase 13 webhook platform work

Phase 11 owns tenant-scoped outbound webhook delivery for notification events. It does not need to become the public API/webhook product platform that Phase 13 covers.

### 4. Losing visibility on failed channel delivery

If retries happen only in memory or final channel failures are not persisted durably, operators will not be able to tell whether an event was delivered, skipped, retried, or permanently failed.

### 5. Overcomplicating global template storage

Trying to retrofit a multi-tenant global-template database model into `NotificationTemplate` may create unnecessary schema churn. Code-owned defaults with tenant overrides fit the existing model better.

### 6. Designing recipient resolution too narrowly

If recipient logic assumes all payloads include raw emails or user IDs, the engine will not work for the completed-phase event shapes already in the codebase.

## Validation Architecture

Phase 11 should validate across four layers:

- schema/build synchronization if retry-status or bookkeeping fields change
- unit tests for event-catalog coverage, preference default-on evaluation, template fallback, HMAC signing/verification, SMS config-gated behavior, and retry-state transitions
- integration tests for inbox/preference/template/webhook-config endpoints and role-gated tenant scoping
- end-to-end engine tests showing that a committed outbox event is picked up within one poll cycle and delivered through in-app, email, and webhook channels for completed-phase event types

Recommended execution commands during the phase:

- `pnpm --filter @amdox/db db:push`
- `pnpm --filter @amdox/db generate`
- `pnpm --filter @amdox/types build`
- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/api run test:unit:raw`
- `pnpm --filter @amdox/api run test:integration:raw`

Wave 0 should include:

- a reusable notification test harness
- event-catalog and template-fallback unit coverage
- API-surface tests for preferences, templates, and webhooks
- processor-level tests for outbox claiming, retry transitions, HMAC signing, email dispatch, and SMS skip behavior

## Planning Implication

The cleanest plan split for Phase 11 is:

1. shared notification foundations, retry bookkeeping, event catalog contracts, test harness, and blocking schema/build sync
2. notification module APIs for inbox, user preferences, tenant template overrides, and tenant webhook configuration
3. outbox poller, BullMQ delivery worker, event resolution, and channel dispatch across in-app/email/webhook/SMS
4. end-to-end compatibility verification for completed-phase events plus validation closeout

That ordering stabilizes the notification domain first, exposes the required configuration surfaces second, builds the engine third, and closes with cross-module verification fourth.
