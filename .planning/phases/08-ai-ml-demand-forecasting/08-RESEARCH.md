# Phase 8: AI/ML Demand Forecasting - Research

**Date:** 2026-04-20
**Phase:** 08-ai-ml-demand-forecasting
**Status:** Complete

## What This Phase Needs To Solve

Phase 8 has to turn the Phase 7 inventory foundation and the current FastAPI stub into a real forecasting capability that:

- builds product-level demand history from tenant-scoped inventory usage
- trains Prophet for every eligible SKU and LSTM only for high-volume SKUs
- removes outliers via IQR before model fitting
- enforces a hard MAPE quality gate at 20%
- returns 30-day forecasts with confidence intervals
- retrains weekly and promotes only when the new model is both better and still acceptable
- leaves behind durable model metadata and forecast results for later BI and supply-chain reuse

The key architectural tension is that the Python service is the right place for model math, while the NestJS backend is already the right place for tenant-aware orchestration, scheduling, and shared ERP data access.

## Codebase Findings

### Existing forecasting-adjacent assets

- `packages/db/prisma/schema.prisma` already defines `ForecastModel` and `ForecastPrediction`, so the data layer already expects forecasting to become a first-class ERP concept.
- `packages/db/prisma/schema.prisma` also already defines `InventoryMovement`, including `movementType`, `productId`, `warehouseId`, and `movedAt`, which gives Phase 8 a durable demand-history source.
- `apps/api/src/prisma/prisma.service.ts` already exposes `forTenant(tenantId)`, which is the correct pattern for scheduled retraining jobs.
- `apps/api/src/supply-chain/reorder/reorder-automation.service.ts` confirms that current replenishment logic is product-scoped and tenant-wide rather than warehouse-local.
- `apps/api/src/supply-chain/queue/supply-chain.queue.ts` and similar queue modules show the repeatable per-tenant BullMQ pattern the forecasting orchestration should mirror.
- `.env.example` already includes `PORT_ML` and `ML_SERVICE_URL`, which means the project already expects a separately running ML service.

### Important gaps

- `apps/ml-service/main.py` is still only a health-stub FastAPI app.
- `apps/ml-service/requirements.txt` currently contains only FastAPI and Uvicorn, so no data-science or test dependencies exist yet.
- `ForecastModel` and `ForecastPrediction` are present, but the metadata surface is too thin for real promotion, artifact tracking, training windows, and forecast provenance.
- `ForecastPrediction.warehouseId` exists as a field, but there is no explicit warehouse relation or current product decision that requires warehouse-level forecasting now.
- No NestJS forecasting module exists yet, so there is no tenant-aware bridge between the ERP data model and the Python ML service.
- No test harness or validation path exists yet for forecasting behavior in either Python or Node.

## Recommended Technical Direction

### 1. Keep the Python service focused on ML computation, not tenant orchestration

The cleanest fit for this repo is:

- FastAPI owns preprocessing, training, inference, confidence intervals, and model inspection
- NestJS owns weekly scheduling, tenant iteration, historical data extraction, promotion, and ERP persistence

Why this fits the repo:

- every existing background workflow in the ERP already uses BullMQ with explicit tenant payloads
- NestJS already owns the shared business data model and tenant rules
- the Python service should specialize in model math instead of duplicating ERP orchestration concerns

### 2. Use daily aggregated `ISSUE` movements as the canonical demand signal

Phase 7 already produced the durable stock ledger that Phase 8 needs. The best forecasting series for this phase is:

- group inventory movements by tenant, product, and day
- include only `movementType = ISSUE`
- sum absolute issued quantity as daily demand

Why this is the right source:

- receipts are supply-side and would distort demand learning
- reorder policy is currently product-level, so product-level demand is the right forecast granularity
- the ledger is already tenant-safe and auditable

### 3. Treat the current forecast tables as the canonical ERP registry, but evolve them

The existing `ForecastModel` and `ForecastPrediction` tables are a good starting point, but planning should assume additions for:

- training window boundaries
- data-point count
- artifact location or artifact key
- promotion timestamp or provenance metadata
- active-model lookup efficiency
- prediction provenance linking back to the source model version

This keeps forecasts durable for:

- Phase 8 health and prediction behavior
- Phase 9 BI forecast-accuracy metrics
- future supply-chain and observability work

### 4. Keep Phase 8 product-scoped and tenant-wide

The user explicitly accepted the recommended product-only scope, and the codebase supports that decision:

- Phase 7 reorder automation is product-scoped and tenant-wide
- warehouse-local reorder thresholds do not exist yet
- `warehouseId` can remain `null` for active Phase 8 prediction outputs

This avoids building warehouse-local forecasting before the rest of the product has warehouse-local replenishment rules to consume it.

### 5. Model selection should be baseline-plus-upgrade, not fixed Prophet-only serving

The most coherent runtime policy is:

- always attempt Prophet for every eligible SKU
- only attempt LSTM when there are at least 500 daily points
- compare each candidate's MAPE against both the active model and the 20% gate
- promote the best qualifying candidate

Why this matters:

- it preserves the project's "Prophet primary, LSTM secondary" direction
- it still allows LSTM to become the serving model when it actually improves forecast quality
- it avoids exposing callers to multiple competing active models

### 6. Prediction should fail closed on quality, not degrade silently

`POST /ml/predict` should:

- locate the active model for the requested tenant and product
- refuse to serve if no active model exists
- refuse to serve if the model's MAPE is above 20%
- return forecast rows with lower and upper confidence bounds when a valid model exists

This is important because Phase 8's value proposition depends on the quality gate being real, not advisory.

### 7. Weekly retraining should reuse the existing per-tenant BullMQ pattern

The scheduling path should look similar to Phase 7 reorder automation:

- register one repeatable retraining job per tenant
- compute demand history in NestJS with `prisma.forTenant(tenantId)`
- send training payloads to FastAPI
- compare returned MAPE with the active model
- promote only when improved and still within the threshold
- persist model and prediction updates in the ERP data store

This keeps cross-module scheduling consistent and avoids inventing a second job-orchestration model inside the Python service.

### 8. Artifact storage needs a seam from the start

The current repo does not yet have a dedicated ML artifact store. Planning should include an explicit storage seam so execution can choose a concrete first implementation such as:

- local filesystem path under the ML service for development
- artifact key persisted in the ERP metadata layer

The important thing is not the exact medium yet. The important thing is that artifact handling is explicit, versioned, and compatible with retraining and promotion.

## Domain Rules The Planner Should Treat As Locked

### Forecasting scope

- forecasts are product-level per tenant for Phase 8
- forecast horizon is 30 daily periods
- warehouse-level serving is deferred

### Training data

- demand history comes from daily aggregated `ISSUE` movements only
- outlier removal uses IQR before fitting
- Prophet is required for every eligible SKU
- LSTM is allowed only at 500 or more points and must use early stopping

### Promotion and serving

- MAPE must be at or below 20%
- weekly retraining compares new versus active MAPE
- only an improved and acceptable model may be promoted
- prediction must reject low-quality or inactive models

### Service boundary

- NestJS owns weekly orchestration and tenant scheduling
- FastAPI owns training and inference
- forecast metadata and outputs remain durable in the ERP persistence layer

## Risks And Planning Traps

### 1. The current forecast schema is too light for production promotion flow

If planning assumes `ForecastModel` as-is is enough, execution will struggle to represent:

- artifact provenance
- training window boundaries
- prediction source linkage
- promotion history

The plan should include schema evolution before runtime logic becomes too coupled to an underspecified model.

### 2. It is easy to overreach into warehouse-level forecasting too early

The database allows `warehouseId`, but current business behavior does not require warehouse-local forecasts yet. Planning should keep warehouse support optional and default-null, not turn it into the primary unit.

### 3. Python dependency compatibility may be the first execution blocker

The project target is Python 3.13, but the current ML service has no model-training dependencies installed yet. Planning should leave room to verify and pin compatible versions of:

- Prophet
- PyTorch
- Pandas/Numpy

This is not a reason to avoid the phase. It is a reason to make dependency setup a first-class execution task.

### 4. Prediction quality can be undermined if MAPE gating is treated as metadata only

If `POST /ml/predict` does not enforce the quality gate at request time, the system can drift into serving unacceptable forecasts even while the metadata says quality matters.

### 5. The Python service can become a second orchestration system if boundaries are blurred

If FastAPI owns scheduling, tenant iteration, and promotion as well as model math, the forecasting architecture will diverge from the rest of the ERP platform and become harder to reason about operationally.

## Validation Architecture

Phase 8 should validate across both runtimes:

- Python-side tests for preprocessing, outlier removal, Prophet training, LSTM gating, early stopping, and predict-response quality gating
- Node-side tests for tenant-aware demand aggregation, weekly retraining orchestration, model promotion, and persistence behavior
- API/HTTP checks for `/ml/train`, `/ml/predict`, `/ml/models`, `/ml/models/{id}`, `/ml/retrain-all`, and `/health`

Recommended verification commands during execution:

- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- a Python test command for `apps/ml-service`

Wave 0 for this phase should include:

- a reusable forecast test store on the API side
- Python test coverage for preprocessing and gating
- Node integration coverage for retraining and promotion

## Planning Implication

The phase should be planned as four sequential concerns:

1. forecast schema/contracts/config foundation
2. FastAPI training and prediction runtime
3. NestJS orchestration, scheduling, and persistence bridge
4. cross-runtime verification and validation artifacts

That split keeps the data model and service boundary stable before the more expensive runtime and scheduling work lands.
