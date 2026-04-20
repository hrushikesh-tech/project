# Phase 8: AI/ML Demand Forecasting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 08-ai-ml-demand-forecasting
**Areas discussed:** Forecast Granularity, Historical Demand Signal, Orchestration Boundary, Model Promotion Policy, Forecast Horizon

---

## Forecast Granularity

| Option                                                                   | Description                                                                                                          | Selected |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- |
| Product-level per tenant, persisted with `warehouseId = null` by default | Matches the current Phase 7 reorder scope and keeps Phase 8 aligned with existing product-level replenishment rules. | yes      |
| Product plus warehouse forecasts as the primary unit                     | Adds warehouse-local forecasting even though reorder policy is not warehouse-scoped yet.                             |          |
| Support both product-only and product-plus-warehouse from day one        | Maximizes flexibility but expands scope and data-model complexity.                                                   |          |

**User's choice:** Recommended option accepted.
**Notes:** The user also explicitly asked that necessary supporting pieces should not be skipped just because they were not the recommended option labels.

---

## Historical Demand Signal

| Option                                                        | Description                                                                                             | Selected |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| Train from daily aggregated `ISSUE` inventory movements only  | Uses demand-side consumption as the forecasting signal and avoids mixing supply events into the series. | yes      |
| Train from net stock movement including `RECEIPT` and `ISSUE` | Simpler to aggregate but blends supply with demand.                                                     |          |
| Use a different source                                        | Would require defining a new canonical demand-history source.                                           |          |

**User's choice:** Recommended option accepted.
**Notes:** This matches the demand-forecasting goal more cleanly than supply-side or net-movement signals.

---

## Orchestration Boundary

| Option                                                                                                   | Description                                                                                         | Selected |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| NestJS owns weekly retraining, promotion, and tenant scheduling; FastAPI handles training and prediction | Reuses the existing BullMQ and tenant-safe orchestration pattern from earlier backend phases.       | yes      |
| FastAPI owns its own scheduler and promotion logic                                                       | Gives the ML service more autonomy but splits tenant scheduling away from the rest of the platform. |          |
| Split ownership another way                                                                              | Would require a different cross-service responsibility map.                                         |          |

**User's choice:** Recommended option accepted.
**Notes:** This keeps forecasting orchestration consistent with the job patterns already established in phases 4 through 7.

---

## Model Promotion Policy

| Option                                                                                                                                                              | Description                                                                                    | Selected |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Train Prophet for every eligible SKU, train LSTM only when there are at least 500 points, and activate whichever model both improves MAPE and stays at or below 20% | Preserves Prophet as the baseline while still allowing LSTM to win when it is actually better. | yes      |
| Prophet always remains the serving model; LSTM is advisory only                                                                                                     | Keeps serving simpler but wastes better-performing LSTM results.                               |          |
| Keep both active and let callers choose                                                                                                                             | Adds runtime complexity and weakens the single active-model contract.                          |          |

**User's choice:** Recommended option accepted.
**Notes:** This directly reflects the user-provided success criteria around LSTM eligibility, MAPE gating, and promote-only-if-better behavior.

---

## Forecast Horizon

| Option                               | Description                                                                                                  | Selected |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| Daily forecasts for the next 30 days | Gives enough forecast runway for downstream planning and BI without overextending short-term signal quality. | yes      |
| Daily forecasts for the next 7 days  | Keeps horizon short but limits broader planning usefulness.                                                  |          |
| Daily forecasts for the next 90 days | Expands planning range at the cost of higher model drift and noisier quality.                                |          |

**User's choice:** Recommended option accepted.
**Notes:** The success criteria provided afterward were treated as locked requirements for the plan and not as optional extras.

---

## the agent's Discretion

- Exact artifact storage mechanism for trained models
- Exact FastAPI request and response DTO names
- Exact queue/job naming for weekly retraining
- Exact persistence split across model metadata, predictions, and health bookkeeping

## Deferred Ideas

- Warehouse-level forecasting
- Forecast-driven automatic purchasing
- Forecast UX and dashboards
- Advanced AI beyond demand forecasting
