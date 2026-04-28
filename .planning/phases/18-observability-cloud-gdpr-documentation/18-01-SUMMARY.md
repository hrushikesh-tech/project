# Phase 18-01 Summary

## What Changed

Implemented the Phase 18 observability runtime foundation across the API, worker, and ML service:

- added explicit telemetry bootstrap code under `apps/api/src/telemetry`
- wired the API and worker entrypoints to initialize telemetry explicitly at runtime startup
- added a Prometheus-compatible metrics surface for the API and ML service
- updated `.env.example` and Helm values overlays with the runtime telemetry contract
- exposed the required business metric names for invoices processed, payroll duration, forecast MAPE, and active users per tenant

## Business Metrics Shape

The metrics are sourced from real runtime seams with a light-touch implementation:

- `invoices_processed_total` records completed invoice posting events and successful invoice-processing API paths
- `payroll_run_duration_seconds` records payroll runtime activity, including worker completion/failure timing
- `forecast_mape_percent` records forecast quality observations from training and prediction paths
- `active_users_per_tenant` is maintained from authenticated runtime activity over a rolling window

## Validation Notes

The telemetry implementation uses repo-native runtime hooks and direct OTLP HTTP export without introducing new observability dependencies.

Manual/live-environment follow-up is still required for:

- confirming traces arrive in the real collector backend
- confirming Prometheus scrapes the chosen metrics endpoints
- confirming dashboards and alert rules evaluate against the emitted metric names

## Files Changed

- `apps/api/src/main.ts`
- `apps/api/src/worker.ts`
- `apps/api/src/telemetry/bootstrap.ts`
- `apps/api/src/telemetry/metrics.ts`
- `apps/api/src/payroll/queue/payroll.processor.ts`
- `apps/api/src/ap-ar/posting/invoice-ledger-posting.service.ts`
- `apps/api/src/forecasting/forecasting.service.ts`
- `apps/ml-service/main.py`
- `apps/ml-service/app/telemetry.py`
- `.env.example`
- `infra/helm/amdox/templates/configmap.yaml`
- `infra/helm/amdox/values.yaml`
- `infra/helm/amdox/values-staging.yaml`
- `infra/helm/amdox/values-prod.yaml`
- `.planning/phases/18-observability-cloud-gdpr-documentation/18-01-SUMMARY.md`
