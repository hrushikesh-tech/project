# Phase 9: Business Intelligence Dashboard - Research

**Date:** 2026-04-21
**Phase:** 09-business-intelligence-dashboard
**Status:** Complete

## What This Phase Needs To Solve

Phase 9 has to turn the existing dashboard schema stub into a real backend BI capability that:

- supports tenant-safe dashboard CRUD with widget layout and saved filters
- exposes the fixed widget types required by the roadmap
- computes eight pre-built ERP metrics from the existing finance, HR, supply-chain, forecasting, and project data model
- provides a live-refresh contract over SSE every 30 seconds without turning the stream into a bulk data channel
- schedules report generation, renders PDF and Excel outputs, stores artifacts durably, and emails download links

The core design tension is that BI touches many domains but should still feel like one backend-owned vertical slice rather than an ad hoc query layer spread across existing modules.

## Codebase Findings

### Existing BI-adjacent assets

- `packages/db/prisma/schema.prisma` already defines `Dashboard`, `Widget`, and `WidgetType`, so the schema already expects BI to become a first-class backend concern.
- `apps/api/src/finance/finance.service.ts` already contains posted-ledger aggregation code for trial balance, balance sheet, and income statement reporting, which is the right anchor for revenue and expense BI metrics.
- `apps/api/src/hr/hr.service.ts` already models employee lifecycle, leave approvals, attendance, and department structure, giving Phase 9 durable sources for headcount and leave-utilization reporting.
- `apps/api/src/supply-chain/supply-chain.service.ts`, `apps/api/src/supply-chain/receiving/goods-receipt.service.ts`, and `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` already provide the purchase-order lifecycle, warehouse inventory, FIFO cost-layer, and operator-event seams needed by supply-chain BI metrics.
- `apps/api/src/forecasting/forecasting.service.ts` already persists promoted forecast models and forecast predictions, which makes forecast-accuracy a durable BI metric rather than a process-local runtime computation.
- `apps/api/src/payroll/pdf/payslip-pdf.service.ts` and `apps/api/src/payroll/storage/payslip-storage.service.ts` provide working patterns for Puppeteer PDF generation and S3-backed artifact storage.
- `.env.example` already exposes SMTP and S3 variables, so report delivery can reuse the current environment surface rather than inventing a new integration contract.

### Important gaps

- The current BI schema is too light for report scheduling and report-run artifact tracking; `Dashboard` and `Widget` alone are not enough for BI-05.
- No `apps/api/src/bi` module exists yet, so there is no domain-owned service layer for dashboard CRUD, metric reads, SSE, or report scheduling.
- No metric-specific DTOs or validation contracts exist yet, which is risky because Phase 9 intentionally rejects a generic query builder.
- No SSE endpoint exists in the API today, and no existing module uses Nest's SSE response model.
- No Excel generation dependency is currently present in `apps/api/package.json`, even though Phase 9 requires Excel report output.
- No BI-specific test harness exists yet for dashboards, widgets, report schedules, or multi-domain metric fixtures.

## Recommended Technical Direction

### 1. Keep BI as a backend-owned vertical slice under `apps/api/src/bi`

The repo’s strongest implementation pattern is a vertical NestJS module with thin controllers, service-heavy business logic, a dedicated exception filter, and domain-specific DTOs.

Phase 9 should follow that same shape:

- `bi.module.ts`
- `bi.controller.ts`
- `bi.service.ts`
- metric-specific services grouped under the BI module
- queue and processor files for report scheduling

This keeps BI cohesive even though it reads across finance, HR, supply-chain, forecasting, and project data.

### 2. Evolve the schema instead of introducing a disconnected BI store

`Dashboard` and `Widget` already exist and should remain the source of truth for saved dashboards. Planning should evolve the schema with BI-specific additions such as:

- better widget config metadata for saved filters and refresh participation
- a report schedule model tied to dashboards
- a report run / report artifact model to track execution status, generated files, and delivery metadata

This is a better fit than inventing a second BI-only registry outside the shared ERP data model.

### 3. Use fixed metric contracts with explicit per-metric filters

The Phase 9 context correctly locked a fixed-metric direction. That matches the repo better than a generic analytics builder because:

- finance reporting already has well-defined ledger semantics
- HR, supply-chain, and forecasting data each have specific lifecycle rules that would be easy to misread through arbitrary client-defined grouping
- the roadmap explicitly names the metrics, so stable contracts are the correct product shape for this phase

The right backend pattern is:

- one validated metric key
- one narrow request DTO or filter contract per metric family
- one chart-ready response shape owned by BI

### 4. Reuse domain source-of-truth logic rather than duplicating it in BI

BI should not reimplement domain rules when the existing modules already define them.

Recommended anchors:

- `revenue_by_month` and `expense_by_category`: derive from posted ledger behavior, not ad hoc invoice totals
- `headcount_by_department`: follow the HR active-roster rules instead of counting all employee rows blindly
- `inventory_value_by_warehouse`: derive from current stock plus FIFO layers, not historical receipt totals
- `po_approval_cycle_time`: use actual PO submission and approval timestamps from the supply-chain lifecycle
- `demand_forecast_accuracy`: compare persisted predictions with realized `ISSUE` demand from the inventory ledger

This keeps BI aligned with the rest of the ERP instead of becoming a parallel interpretation layer.

### 5. Use SSE as invalidation, not as the metric transport

The context decision to stream lightweight refresh events is the right technical fit for this repo.

Why:

- full metric payload pushes would duplicate the normal metric-read path
- the frontend builder is still deferred to Phase 12, so the stream contract should stay simple
- 30-second heartbeat-style refresh events are easy to reason about and test

The best Phase 9 SSE contract is:

- dashboard-scoped subscription
- event includes dashboard ID, timestamp, and changed metric/widget keys
- clients re-fetch through normal BI endpoints

### 6. Scheduled reports should reuse the queue + artifact + delivery patterns already in the repo

Phase 9 report generation should look like the repo’s other long-running workflows:

- BullMQ repeatable jobs for schedules
- a processor that loads the saved dashboard and metric snapshot
- Puppeteer for PDF rendering
- ExcelJS for spreadsheet export
- S3-backed artifact storage
- durable `OutboxEvent` / `Notification` records plus SMTP email dispatch

This keeps scheduled reporting consistent with payroll artifacts and reorder/forecasting job patterns.

### 7. Treat `project_budget_vs_actual` as a first-class contract even before Phase 10 is implemented

The schema already contains `Project` and related task/milestone models. Because Phase 10 is not built yet, Phase 9 should plan for:

- a real metric contract and endpoint now
- a safe empty-data response until project records exist

That avoids changing the BI API surface later when the project module becomes active.

### 8. Wave 0 should include a dedicated BI test harness

Like supply-chain and forecasting, BI is cross-domain enough that execution will be much cleaner if the phase starts with a dedicated in-memory harness for:

- dashboards
- widgets
- report schedules
- report runs
- cross-domain metric fixtures (ledger rows, employees, leave, inventory, forecasts, projects)

Without that harness, BI tests will either be too thin or will copy setup from multiple unrelated helpers.

## Domain Rules The Planner Should Treat As Locked

### Dashboard and widget behavior

- dashboards are tenant-scoped
- owners manage their dashboards; `tenant_admin` can manage all tenant dashboards
- `isPublic` means tenant-internal read-only visibility, never anonymous/public internet access
- widgets are fixed to roadmap widget types and fixed BI metric keys

### Metric behavior

- metrics remain fixed backend contracts, not user-defined analytics
- filters are explicit and per-metric
- table widgets expose summarized BI rows only, not raw-record browsing
- `project_budget_vs_actual` may return empty data until Phase 10 populates projects

### Live refresh

- the stream interval is 30 seconds
- SSE carries refresh events, not full datasets
- metric reads remain the source of truth for refreshed values

### Reporting

- reports are generated from saved dashboards
- PDF and Excel outputs are both required
- artifacts are stored durably and emailed as download links
- failures must be durable and operator-visible

## Risks And Planning Traps

### 1. BI can silently become a generic query engine

If planning is loose about metric boundaries, execution will drift into arbitrary filters, grouping, and raw record export. That would contradict the locked context and greatly expand the risk surface.

### 2. Inventory value is easy to miscompute if FIFO rules are ignored

A naive inventory value metric based only on receipt totals or current quantity without cost layers will not match the Phase 7 costing rules. Planning must anchor valuation to the FIFO layer model.

### 3. Forecast accuracy can be distorted if future-dated predictions are compared too early

Only elapsed forecast dates should be compared with realized demand. If BI compares all stored predictions indiscriminately, the metric will misstate accuracy.

### 4. Report scheduling needs durable execution status from day one

If report jobs fail without persistent status, operators will have no way to understand missed reports until the notification phase arrives. Planning should make report-run state explicit, not implicit.

### 5. SSE is easy to overbuild

Phase 9 does not need collaborative real-time dashboards or a data-push bus. If planning treats SSE like a high-bandwidth feed instead of invalidation, the stream path will become more complex than the current product stage requires.

### 6. Excel generation is a dependency and verification risk

Puppeteer is already present, but ExcelJS is not. Planning should treat spreadsheet export as a first-class execution task rather than an afterthought in the reporting wave.

## Validation Architecture

Phase 9 should validate across four layers:

- schema and shared-contract validation for dashboard/report models
- unit tests for dashboard CRUD rules, metric services, report scheduling decisions, and refresh-event generation
- integration tests for BI API flows, scheduled-report execution, and artifact persistence metadata
- manual or semi-manual validation for the SSE stream shape and report file readability

Recommended verification commands during execution:

- `pnpm --filter @amdox/db generate`
- `pnpm --filter @amdox/types build`
- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/api run test:unit:raw`
- `pnpm --filter @amdox/api run test:integration:raw`

Wave 0 for this phase should include:

- a reusable BI test store
- metric-service unit coverage
- report scheduling/execution integration coverage
- at least one SSE contract test or stream-shape smoke check

## Planning Implication

The cleanest plan split for Phase 9 is:

1. BI schema, shared contracts, config surface, and BI test harness
2. BI module plus dashboard/widget CRUD and fixed metric contract surface
3. Metric aggregation services plus SSE refresh endpoint
4. Scheduled reports, artifact/email delivery, and verification/validation updates

That ordering keeps the schema and API surface stable before the more expensive cross-domain aggregation and reporting work lands.
