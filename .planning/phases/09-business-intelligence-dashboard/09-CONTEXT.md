# Phase 9: Business Intelligence Dashboard - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend BI slice for tenant-scoped dashboard CRUD, widget configuration, eight pre-built ERP metrics, dashboard refresh over Server-Sent Events, and scheduled report generation with PDF/Excel output plus emailed download links.

This phase delivers the backend contracts, aggregation rules, scheduling behavior, and delivery seams needed for BI dashboards. It does not add the drag-and-drop frontend dashboard builder, custom SQL reporting, cross-tenant sharing, or collaborative dashboard editing.

</domain>

<decisions>
## Implementation Decisions

### Metric Contracts

- **D-01:** Phase 9 should use fixed built-in metric contracts with narrow, explicit filters rather than a generic query builder.
- **D-02:** Widget configuration may scope a metric by approved filter inputs such as date range, legal entity, warehouse, department, project status, or product, but it must not redefine the metric's core meaning.
- **D-03:** `revenue_by_month` should aggregate posted revenue journal lines by calendar month with optional date-range and legal-entity filters.
- **D-04:** `expense_by_category` should aggregate posted expense journal lines by account/category with optional date-range and legal-entity filters.
- **D-05:** `headcount_by_department` should count employees in the active roster by department as of a selected date, treating approved leave as operational state rather than a separate headcount status.
- **D-06:** `inventory_value_by_warehouse` should represent the current on-hand inventory value by warehouse using remaining FIFO cost layers and current inventory balances, not a historical valuation replay.
- **D-07:** `po_approval_cycle_time` should measure the elapsed time from PO submission to approval for approved purchase orders within a selected reporting window.
- **D-08:** `leave_utilisation_by_type` should aggregate approved leave days by leave type over a selected reporting window, with optional department scoping.
- **D-09:** `project_budget_vs_actual` should read directly from the shared `Project` records and may legitimately return an empty dataset until Phase 10 starts populating project data.
- **D-10:** `demand_forecast_accuracy` should compare Phase 8 forecast predictions against realized `ISSUE` demand only for elapsed forecast dates, exposing an accuracy-oriented aggregate derived from forecast error rather than raw model internals.

### Dashboard Ownership and Visibility

- **D-11:** Dashboards are always tenant-scoped.
- **D-12:** Dashboard owners may edit and delete their own dashboards, and `tenant_admin` may manage any dashboard in the tenant.
- **D-13:** `isPublic` should mean tenant-internal read-only visibility for authenticated users with dashboard-view access; it must never mean anonymous or cross-tenant access.
- **D-14:** Widgets inherit dashboard visibility, and Phase 9 should not introduce per-widget ACL rules.

### Refresh and Delivery Behavior

- **D-15:** The SSE contract should emit lightweight dashboard refresh events every 30 seconds for active subscribers instead of streaming full metric payloads.
- **D-16:** SSE events should identify the dashboard, refresh timestamp, and affected metric/widget keys so clients can re-fetch fresh data through normal metric endpoints.
- **D-17:** Phase 9 should prefer on-demand metric reads plus SSE invalidation over server-pushed full datasets to keep backend cost predictable before the frontend dashboard builder arrives.

### Scheduled Reports

- **D-18:** Scheduled reports should target saved dashboards and render the dashboard's current widget set and saved filters at execution time.
- **D-19:** Report generation should run asynchronously via BullMQ and produce both PDF and Excel outputs from the same metric snapshot.
- **D-20:** Generated report artifacts should be stored in S3-style object storage and delivered by email as download links rather than large file attachments.
- **D-21:** Phase 9 should send report emails directly through the existing SMTP/Mailpit-style environment contract while also recording durable outbox and notification events for later Phase 11 integration.
- **D-22:** Failed report runs must leave durable operator-visible status and failure details rather than failing silently.

### Widget Configuration Surface

- **D-23:** Widget config should support title, widget type, metric key, layout position/size, refresh participation, and approved metric-specific filters.
- **D-24:** Sorting, top-N, and limited breakdown selection are acceptable only when a metric explicitly supports them; free-form grouping and arbitrary field selection are out of scope.
- **D-25:** Table widgets should expose summarized BI rows only; Phase 9 should not expose raw record export or ad hoc row-level browsing through the dashboard metric APIs.

### the agent's Discretion

- Exact endpoint names and DTO shapes for BI dashboards, widgets, metric reads, SSE streams, and report schedules
- Exact persistence split between dashboard metadata, report schedule definitions, and report-run artifacts
- Exact email template wording and report file-key naming
- Exact response shapes for chart-ready metric payloads, as long as each built-in metric remains fixed and tenant-safe

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 9 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `BI-01` through `BI-05`, plus relevant constraints from `FIN-07`, `HR-01` through `HR-07`, `SC-02` through `SC-05`, `ML-01` through `ML-05`, `SEC-07`, and `SEC-08`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable constraints
- `.planning/STATE.md` - current execution state and prior-phase carry-forward notes

### Prior phase context that constrains BI

- `.planning/phases/05-hr-core/05-CONTEXT.md` - employee lifecycle, leave semantics, department structure, and attendance rules that shape BI headcount and leave metrics
- `.planning/phases/06-payroll-engine/06-CONTEXT.md` - established queue, artifact storage, and operator-visible long-running workflow patterns
- `.planning/phases/07-supply-chain-inventory/07-CONTEXT.md` - FIFO valuation, PO lifecycle, warehouse semantics, and reorder data assumptions for BI supply-chain metrics
- `.planning/phases/08-ai-ml-demand-forecasting/08-CONTEXT.md` - forecast prediction contract, quality-gated active models, and durable forecast outputs that power BI forecast-accuracy metrics

### Existing data model and shared enums

- `packages/db/prisma/schema.prisma` - existing `Dashboard`, `Widget`, `ForecastPrediction`, `ForecastModel`, `JournalEntry`, `JournalLine`, `Employee`, `Department`, `LeaveRequest`, `InventoryItem`, `CostLayer`, `PurchaseOrder`, `Project`, `Notification`, and `OutboxEvent` models
- `packages/db/src/index.ts` - exported Prisma surface available to the API layer
- `packages/types/src/enums.ts` - shared workflow/status enums used by project, HR, and supply-chain data
- `packages/types/src/ml.ts` - forecast quality and active-model expectations that constrain forecast-accuracy reporting

### Existing backend patterns and implementation seams

- `apps/api/src/app.module.ts` - current module registration and global guard/interceptor setup
- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit `forTenant()` background-job pattern
- `apps/api/src/finance/finance-reports.controller.ts` - existing report endpoint pattern
- `apps/api/src/finance/finance.service.ts` - posted-ledger report aggregation logic reusable for BI finance metrics
- `apps/api/src/hr/hr.controller.ts` - current HR read surface for department, employee, leave, and attendance-backed metrics
- `apps/api/src/supply-chain/supply-chain.controller.ts` - purchase-order, warehouse, and product data seams relevant to BI supply-chain metrics
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` - durable outbox pattern and supply-chain job conventions
- `apps/api/src/forecasting/forecasting.controller.ts` - forecasting read contract and tenant handling
- `apps/api/src/forecasting/forecasting.service.ts` - persisted prediction/model behavior used by demand-forecast-accuracy metric
- `apps/api/src/forecasting/queue/forecasting.queue.ts` - repeatable BullMQ job registration pattern
- `apps/api/src/forecasting/queue/forecasting.processor.ts` - worker-host processing pattern for scheduled jobs
- `apps/api/src/common/schedule/schedule.ts` - shared cron-expression helper surface
- `apps/api/src/payroll/pdf/payslip-pdf.service.ts` - Puppeteer PDF-generation pattern
- `apps/api/src/payroll/storage/payslip-storage.service.ts` - S3 artifact-storage pattern
- `.env.example` - SMTP and storage environment contracts already available for report delivery

### Codebase guidance

- `.planning/codebase/ARCHITECTURE.md` - backend module and request-flow guidance
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, and service-layer implementation expectations
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

No separate external BI specs or ADRs exist yet - the BI requirements are fully captured by the references above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma` already includes `Dashboard`, `Widget`, and `WidgetType`, so Phase 9 can evolve an existing BI schema foundation instead of inventing a disconnected model.
- `apps/api/src/finance/finance.service.ts` already contains posted-ledger aggregation logic that can anchor finance BI metrics.
- `apps/api/src/forecasting/forecasting.service.ts` already persists active forecast models and forecast predictions, giving Phase 9 a durable source for forecast-accuracy calculations.
- `apps/api/src/payroll/pdf/payslip-pdf.service.ts` and `apps/api/src/payroll/storage/payslip-storage.service.ts` provide working patterns for PDF rendering and S3-backed artifact storage.
- `apps/api/src/forecasting/queue/*.ts` and `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` provide repeatable-job and durable outbox patterns that scheduled BI reporting should reuse.
- `.env.example` already defines `SMTP_HOST`, `SMTP_PORT`, S3, and Puppeteer-related variables, so Phase 9 does not need to invent a new delivery environment contract.

### Established Patterns

- Backend capabilities land as vertical NestJS modules with thin controllers and service-heavy business logic.
- Background and scheduled workflows use BullMQ with explicit tenant IDs instead of request CLS.
- Long-running workflows leave durable outbox/notification traces for operator visibility.
- Artifact-style outputs are stored in S3-compatible storage rather than left local to the API process.
- Reporting logic prefers backend-owned aggregation contracts over frontend-defined query semantics.

### Integration Points

- Phase 9 should land as a new backend module under `apps/api/src/bi` or an equivalently clear BI vertical slice.
- BI metric services need to read from finance, HR, supply-chain, forecasting, and project models without violating tenant scoping.
- Dashboard refresh should expose a dashboard-scoped SSE endpoint plus standard metric-read endpoints rather than embedding refresh logic into existing modules.
- Scheduled report generation should connect dashboard definitions, BullMQ scheduling, PDF/Excel rendering, S3 artifact storage, SMTP delivery, and durable notification/outbox records.

</code_context>

<specifics>
## Specific Ideas

- Keep Phase 9 focused on fixed ERP metrics first; do not turn it into a generic analytics platform.
- Treat public dashboards as tenant-internal shared dashboards, not internet-facing reports.
- Prefer SSE invalidation events over full server-pushed widget payloads so Phase 12 can choose its own re-fetch behavior cleanly.
- Let `project_budget_vs_actual` exist as a valid metric contract now even if it is empty until Phase 10 starts creating project data.
- Use emailed download links rather than attachments so scheduled reports scale cleanly and reuse object storage.

</specifics>

<deferred>
## Deferred Ideas

- End-user custom SQL or arbitrary report-builder queries
- Cross-tenant, anonymous, or externally published dashboards
- Collaborative real-time dashboard editing
- Historical inventory valuation replay beyond the current FIFO-backed snapshot
- Natural-language BI querying or anomaly-detection features

</deferred>

---

_Phase: 09-business-intelligence-dashboard_
_Context gathered: 2026-04-21_
