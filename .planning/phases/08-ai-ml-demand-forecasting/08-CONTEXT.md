# Phase 8: AI/ML Demand Forecasting - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend forecasting slice across the existing NestJS ERP backend and the Python FastAPI ML service: prepare tenant-safe demand history from Phase 7 inventory activity, train Prophet and LSTM models under explicit quality gates, expose prediction and model-inspection endpoints, and run weekly retraining with promote-only-if-better behavior.

This phase delivers model training, prediction, promotion, and health visibility. It does not add forecast-driven purchasing automation, warehouse-level replenishment policy, BI dashboards, anomaly detection, or frontend UX.

</domain>

<decisions>
## Implementation Decisions

### Forecast Scope

- **D-01:** The primary forecasting unit for Phase 8 is tenant-level product demand. Persisted predictions should default `warehouseId` to `null`.
- **D-02:** Phase 8 should produce daily forecasts for the next 30 days.
- **D-03:** Warehouse-level forecasting remains deferred because Phase 7 reorder logic is still product-scoped and tenant-wide.

### Historical Demand Signal

- **D-04:** Training data should be built from daily aggregated `ISSUE` inventory movements only.
- **D-05:** `RECEIPT` and other supply-side movements must not be treated as demand signals for forecasting.
- **D-06:** Demand history should be derived from the existing Phase 7 inventory ledger rather than introducing a parallel forecasting-only source of truth.

### Service Boundary and Orchestration

- **D-07:** NestJS owns tenant-aware historical data extraction, weekly scheduling, retraining orchestration, and model-promotion decisions.
- **D-08:** The Python FastAPI service owns preprocessing, model training, model inference, confidence-interval generation, and model/health inspection endpoints.
- **D-09:** Phase 8 should persist model metadata and forecast outputs in the existing ERP data model so downstream phases such as BI can consume durable forecasting results.

### Model Strategy and Quality Gate

- **D-10:** Prophet is the baseline model for every eligible SKU and must train on IQR-cleaned historical data using multiplicative seasonality.
- **D-11:** LSTM runs only for SKUs with at least 500 historical data points and must use early stopping.
- **D-12:** A newly trained model may be promoted only when its MAPE improves on the currently active model and remains at or below 20%.
- **D-13:** When both Prophet and LSTM pass the quality gate, the better-performing model becomes active for serving rather than hard-coding Prophet as the serving model.

### Prediction Contract

- **D-14:** `POST /ml/predict` must return forecasts with confidence intervals for the requested 30-day horizon.
- **D-15:** Prediction requests must reject inactive models or models whose MAPE exceeds 20% instead of silently serving low-quality forecasts.
- **D-16:** Supporting implementation pieces that are necessary to satisfy the locked success criteria should still be built even if they were not one of the explicitly selected product options.

### the agent's Discretion

- Exact forecast artifact-storage mechanism, as long as model versions are durable enough for retraining, promotion, and later prediction calls
- Exact FastAPI endpoint payload shapes and DTO naming, as long as the roadmap-required endpoints and contracts remain covered
- Exact queue names, repeat-job naming, and schedule-helper wiring for weekly retraining
- Exact internal persistence split between model metrics, artifacts, and prediction snapshots, as long as quality-gated promotion and Phase 9 BI reuse remain possible

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 8 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` - `ML-01` through `ML-05`, plus cross-cutting constraints from `SC-03`, `SEC-07`, `SEC-08`, and `OBS-04`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable quality constraints
- `.planning/STATE.md` - current execution state and prior-phase carry-forward notes

### Prior phase context that constrains Phase 8

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - tenant scoping, audit expectations, and background-operation rules
- `.planning/phases/06-payroll-engine/06-CONTEXT.md` - repeatable-job, per-tenant worker, and durable operator-visible workflow patterns
- `.planning/phases/07-supply-chain-inventory/07-CONTEXT.md` - tenant-wide product-scoped reorder behavior, inventory-movement semantics, and product/warehouse data assumptions

### Existing data model and code seams

- `packages/db/prisma/schema.prisma` - existing `ForecastModel`, `ForecastPrediction`, `Product`, `InventoryItem`, `InventoryMovement`, and related tenant-scoped models
- `packages/db/src/index.ts` - exported Prisma surface available to the API layer
- `packages/types/src/enums.ts` - existing evolving enum strategy and inventory movement types
- `apps/api/src/prisma/prisma.service.ts` - explicit `forTenant()` pattern for background operations
- `apps/api/src/app.module.ts` - current module registration and global guard/interceptor setup
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` - current tenant-wide product reorder logic that Phase 8 must remain compatible with
- `apps/api/src/supply-chain/queue/supply-chain.queue.ts` - repeatable per-tenant BullMQ registration pattern
- `apps/api/src/supply-chain/queue/supply-chain.processor.ts` - explicit tenant-aware worker pattern
- `apps/api/src/common/schedule/schedule.ts` - current cron-expression helper surface
- `apps/ml-service/main.py` - current FastAPI stub that Phase 8 must evolve into a real ML runtime
- `apps/ml-service/requirements.txt` - current Python dependency surface
- `.env.example` - existing ML service URL and environment-contract foundation

### Codebase guidance

- `.planning/codebase/ARCHITECTURE.md` - NestJS request flow, service boundaries, and persistence expectations
- `.planning/codebase/CONVENTIONS.md` - tenant scoping, validation, and backend implementation conventions
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

No separate external ADRs or product specs exist yet - the forecasting requirements are fully captured by the references above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma` already contains `ForecastModel` and `ForecastPrediction`, so Phase 8 should evolve an existing forecast persistence foundation rather than introducing a disconnected storage path.
- `packages/db/prisma/schema.prisma` also already contains `InventoryMovement`, which gives Phase 8 a durable historical signal for demand extraction.
- `apps/api/src/prisma/prisma.service.ts` already provides `forTenant()` for tenant-safe background work.
- `apps/api/src/supply-chain/queue/*.ts`, `apps/api/src/hr/queue/*.ts`, and `apps/api/src/payroll/queue/*.ts` provide the repeatable-job and worker-host pattern Phase 8 should reuse.
- `.env.example` already exposes `PORT_ML` and `ML_SERVICE_URL`, so the inter-service contract has a project-level starting point.

### Established Patterns

- Backend capabilities land as vertical NestJS modules with thin controllers and service-heavy business logic.
- Scheduled and long-running workflows use BullMQ with explicit tenant payloads rather than request CLS.
- Evolving workflow states stay string-backed in application code rather than becoming Prisma enums unless there is a strong reason otherwise.
- Durable outputs that later phases need should live in the shared ERP data layer instead of being left process-local only.

### Integration Points

- Phase 8 needs a new forecasting-oriented backend module in `apps/api/src` to orchestrate data extraction, scheduling, and promotion.
- Phase 8 also needs a real implementation under `apps/ml-service` for the Python training and prediction runtime.
- Forecast outputs should remain compatible with Phase 7 product-level replenishment assumptions and be durable enough for Phase 9 BI metrics such as forecast accuracy.

</code_context>

<specifics>
## Specific Ideas

- Keep Phase 8 product-scoped first so it matches the actual reorder and inventory rules already in production from Phase 7.
- Use only demand-side `ISSUE` movements to avoid mixing supply events into the training signal.
- Let NestJS remain the orchestration and promotion owner so the project keeps one clear place for tenant scheduling and cross-module coordination.
- Do not skip infrastructure that is necessary to fulfill the success criteria just because it was not one of the original option labels.

</specifics>

<deferred>
## Deferred Ideas

- Warehouse-level forecast models and warehouse-specific promotion policy
- Forecast-driven purchase-order creation or automatic replenishment tuning
- Financial anomaly detection and other advanced AI beyond demand forecasting
- Frontend forecast exploration, charts, and operator workflows

</deferred>

---

_Phase: 08-ai-ml-demand-forecasting_
_Context gathered: 2026-04-20_
