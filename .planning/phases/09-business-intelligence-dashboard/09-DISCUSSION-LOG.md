# Phase 9: Business Intelligence Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `09-CONTEXT.md`; this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 09-business-intelligence-dashboard
**Areas discussed:** Metric contracts, dashboard sharing, SSE refresh behavior, report scheduling, widget configuration

---

## Metric Contracts

| Option                      | Description                                                                | Selected |
| --------------------------- | -------------------------------------------------------------------------- | -------- |
| Strict ERP metrics only     | Fixed backend contracts with narrow allowed filters and stable definitions |          |
| Semi-flexible metrics       | Fixed core metric definitions with explicit scoped filters per metric      | X        |
| Highly configurable metrics | Query-template style metrics with broad grouping and filter control        |          |

**User's choice:** Recommended option selected on the user's behalf.
**Notes:** The project benefits most from fixed metric semantics with limited approved filters because it protects correctness across finance, HR, supply-chain, and forecasting data while still giving dashboards enough flexibility to be useful.

---

## Dashboard Sharing

| Option                 | Description                                                     | Selected |
| ---------------------- | --------------------------------------------------------------- | -------- |
| Owner-only             | Dashboards remain private to the creator unless duplicated      |          |
| Tenant-internal public | `isPublic` exposes read-only access inside the same tenant only | X        |
| Broad public sharing   | Public dashboards can be shared externally or anonymously       |          |

**User's choice:** Recommended option selected on the user's behalf.
**Notes:** Tenant-internal read-only sharing matches the schema's `isPublic` field, keeps access rules simple, and avoids introducing external publication risk before the frontend and broader security hardening phases.

---

## SSE Refresh Behavior

| Option                          | Description                                                                         | Selected |
| ------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Full widget payload push        | SSE carries refreshed datasets for subscribed dashboards                            |          |
| Lightweight invalidation events | SSE signals refresh timestamps and affected widgets; clients re-fetch data normally | X        |
| No live streaming               | Dashboards refresh only through polling or manual reload                            |          |

**User's choice:** Recommended option selected on the user's behalf.
**Notes:** Lightweight invalidation is the best fit for this backend-first phase because it satisfies the 30-second SSE requirement without making the stream channel responsible for every metric payload.

---

## Report Scheduling

| Option                     | Description                                                                             | Selected |
| -------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Dashboard snapshot reports | Scheduled jobs render saved dashboards and email download links for PDF/Excel artifacts | X        |
| Widget bundle reports      | Users schedule arbitrary sets of widgets outside a saved dashboard                      |          |
| Attachment-first reports   | Reports are emailed as file attachments instead of artifact links                       |          |

**User's choice:** Recommended option selected on the user's behalf.
**Notes:** Dashboard-scoped scheduled reports reuse saved widget layout and filters cleanly, work well with queued generation, and scale better when the email contains download links instead of large attachments.

---

## Widget Configuration

| Option                     | Description                                                                 | Selected |
| -------------------------- | --------------------------------------------------------------------------- | -------- |
| Minimal config             | Only title, type, position, and metric key                                  |          |
| Scoped presentation config | Layout plus approved filters, limited sorting, top-N, and breakdown options | X        |
| Open analytics config      | Arbitrary grouping, joins, formulas, and field selection                    |          |

**User's choice:** Recommended option selected on the user's behalf.
**Notes:** Scoped presentation config gives enough room for real dashboards while keeping metric correctness and API complexity under control.

---

## the agent's Discretion

- Exact DTO and endpoint naming for BI resources
- Exact artifact key naming and email copy
- Exact response shapes for chart-ready payloads
- Exact persistence shape for schedules and report runs

## Deferred Ideas

- Custom SQL or generic analytics-builder behavior
- External/public internet dashboard sharing
- Collaborative dashboard editing
- Natural-language BI queries
