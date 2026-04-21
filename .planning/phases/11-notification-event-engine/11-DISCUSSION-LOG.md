# Phase 11: Notification & Event Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 11-notification-event-engine
**Areas discussed:** Preference defaults and override rules, Template fallback model, Delivery and retry behavior, Webhook subscription scope, Event catalog boundary, SMS delivery boundary

---

## Preference defaults and override rules

| Option                              | Description                                                  | Selected |
| ----------------------------------- | ------------------------------------------------------------ | -------- |
| All channels enabled by default     | Supported channels start on; users opt out per event/channel | X        |
| All channels disabled except in-app | Users opt in to email/webhook/SMS                            |          |
| Mixed defaults by severity          | Defaults vary by event criticality and channel               |          |

**User's choice:** All supported channels start enabled by default for supported event types, and users opt out per event/channel.
**Notes:** This makes preference rows override default behavior rather than acting as mandatory opt-in records.

---

## Template fallback model

| Option                                  | Description                                                                         | Selected |
| --------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Platform defaults plus tenant overrides | Ship default templates for every event/channel and let tenants override selectively | X        |
| Tenant templates required               | No delivery until a tenant configures each template                                 |          |
| Mixed fallback                          | Defaults for in-app/email, explicit setup for webhook/SMS                           |          |

**User's choice:** Ship platform default templates for every event/channel, with optional tenant overrides.
**Notes:** Phase 11 should be usable immediately without forcing tenants to preconfigure all templates.

---

## Delivery and retry behavior

| Option              | Description                                          | Selected |
| ------------------- | ---------------------------------------------------- | -------- |
| Bounded retries     | Retry with bounded backoff, then mark failed durably | X        |
| Retry until success | Keep retrying forever until the delivery succeeds    |          |
| Single attempt      | Try once, then stop and rely on operators            |          |

**User's choice:** Retry failed channel deliveries with bounded backoff, then mark failed with durable status.
**Notes:** Durable failure visibility matters more than endless retries.

---

## Webhook subscription scope

| Option                                | Description                                                     | Selected |
| ------------------------------------- | --------------------------------------------------------------- | -------- |
| Broadcast to all matching endpoints   | Send each event to every active tenant webhook subscribed to it | X        |
| One canonical endpoint per event type | Limit each event type to one endpoint per tenant                |          |
| One global endpoint per tenant        | Single tenant endpoint receives all events                      |          |

**User's choice:** Broadcast matching events to all active tenant webhook endpoints subscribed to that event.
**Notes:** This keeps the notification engine flexible for external tenant integrations.

---

## Event catalog boundary

| Option                                                         | Description                                                                    | Selected |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Wire completed-phase events fully and seed the broader catalog | Deliver existing events now and seed structure for the rest of the 20+ catalog | X        |
| Require all 20+ event types to be runnable now                 | Every roadmap event must be fully emitted and delivered in this phase          |          |
| Minimal subset only                                            | Support only a small event set and defer the broader catalog                   |          |

**User's choice:** Fully implement the delivery engine for events already emitted by completed phases, and seed the broader 20+ event catalog/templates/preferences structure for the rest.
**Notes:** This avoids blocking on future producers while still making the notification platform structurally complete.

---

## SMS delivery boundary

| Option                       | Description                                                                           | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------- |
| First-class but config-gated | SMS exists in templates, preferences, and workers; sending depends on provider config | X        |
| Fully live SMS               | SMS must send in production-like form in Phase 11                                     |          |
| Deferred entirely            | Do not implement SMS dispatch behavior in this phase                                  |          |

**User's choice:** SMS is a first-class channel in preferences, templates, and delivery workers, but actual sending is config-gated and may record durable failed/skipped delivery when no provider is configured.
**Notes:** The channel should be real in the engine even when a live SMS provider is absent in current environments.

---

## the agent's Discretion

- Exact queue and worker split for outbox polling, fan-out, and per-channel dispatch
- Exact bounded retry schedule and failure-state names
- Exact event-template field set and payload-shaping details
- Exact provider seam for email, SMS, and webhook transport implementations

## Deferred Ideas

None.
