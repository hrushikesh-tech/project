# Phase 12: Frontend (Next.js 15) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `12-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 12-frontend-next-js-15
**Areas discussed:** Version target, app shell, cross-module UX style, dashboard builder, project Gantt UX, offline/PWA behavior, landing behavior, offline queue boundary

---

## Version Target

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on `Next.js 16` | Treat the roadmap wording as stale and keep the current repo version. | |
| Align back to `Next.js 15` | Match the roadmap and delivery requirement exactly. | x |
| Keep code 15-compatible but avoid downgrade unless blocked | Middle ground that delays a hard alignment decision. | |

**User's choice:** Align the frontend to `Next.js 15`.
**Notes:** User clarified they were explicitly told to deliver the project using Next.js 15, so the current `next@16.2.3` entry in `apps/web/package.json` should be treated as drift to correct.

---

## App Shell

| Option | Description | Selected |
|--------|-------------|----------|
| Unified ERP shell | One persistent shell with shared navigation and consistent module framing. | |
| Dashboard-first shell | Role-oriented home experience dominates and modules feel more independent. | |
| Hybrid | Unified shell underneath with strong role-oriented landing pages. | x |

**User's choice:** Hybrid shell.
**Notes:** This was later refined so users land on a role-based home first after login.

---

## Cross-Module UX Style

| Option | Description | Selected |
|--------|-------------|----------|
| Enterprise grid-first | Dense tables, compact forms, and information-first layouts. | |
| Visual workspace | More cards, larger spacing, and softer visual presentation. | |
| Enterprise core with visual highlights | Serious operational UX with richer summary and landing surfaces. | x |

**User's choice:** Enterprise core with visual highlights.
**Notes:** Recommended because the phase success criteria require both dense operational surfaces and richer dashboard/Gantt experiences.

---

## Dashboard Builder

| Option | Description | Selected |
|--------|-------------|----------|
| Strict preset layouts | Limited layout freedom with curated templates. | |
| Flexible layout, fixed widget semantics | Drag, resize, and configure approved widgets without changing metric meaning. | x |
| Highly customizable workspace | Broad widget-level freedom approaching a custom analytics product. | |

**User's choice:** Flexible layout, fixed widget semantics.
**Notes:** This aligns with Phase 9, which already locked BI to fixed built-in metric contracts and controlled filters.

---

## Project Gantt UX

| Option | Description | Selected |
|--------|-------------|----------|
| Visual planning board | Primarily view-focused with limited direct edits. | |
| Interactive scheduling with bounded edits | Direct rescheduling and dependency visibility without a full planning engine. | x |
| Full scheduling workspace | Rich auto-scheduling and deeper planning mechanics. | |

**User's choice:** Interactive scheduling with bounded edits.
**Notes:** Recommended because the phase requires drag-to-reschedule and dependency arrows, but Phase 10 did not open scope for advanced scheduling logic.

---

## Offline / PWA Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly read-only offline | Cache routes and data but allow few or no queued mutations. | |
| Selective offline queue | Queue bounded low-risk actions and keep sync state visible. | x |
| Broad offline-first | Queue most mutations across the ERP. | |

**User's choice:** Selective offline queue.
**Notes:** Recommended because the phase requires offline queueing, but the product includes high-risk financial and operational workflows that should not be treated as broadly offline-safe.

---

## Post-Login Landing Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Role-based home first | Users enter a role-specific landing page before deeper module work. | x |
| Last-used module first | Users jump back into their most recent module. | |
| Admin-configurable default | Tenant admin chooses the default landing mode. | |

**User's choice:** Role-based home first.
**Notes:** This clarified how the hybrid shell should behave in practice.

---

## Offline Queue Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Queue only low-risk draft and preference actions | Conservative, integrity-first offline queue boundary. | x |
| Queue most non-financial edits | Broader support while still excluding some critical flows. | |
| Queue everything except finance and payroll | Aggressive offline support across most of the ERP. | |

**User's choice:** Queue only low-risk draft and preference actions.
**Notes:** This locks the offline boundary to safe drafts/preferences and keeps high-risk workflows online-only.

---

## the agent's Discretion

- Exact route tree and provider layout
- Exact shared-component split between `packages/ui` and `apps/web`
- Exact visual language and component density system
- Exact safe-action list inside the selective offline queue boundary

## Deferred Ideas

- Next.js 16 adoption
- Fully open-ended BI builder behavior
- Full scheduling-engine behavior in the Gantt surface
- Broad offline-first mutation support across ERP modules

