# Observability Assets

This directory is the repo-owned surface for Phase 18 observability assets.

## Contract

- `prometheus/alerts.yaml` holds the alert rules that correspond to the Phase 18 roadmap thresholds.
- `grafana/api-performance.json` is the app-first API dashboard.
- `grafana/business-metrics.json` is the app-first business dashboard.
- `grafana/infrastructure.json` is intentionally thin and only carries enough golden signals to triage app issues quickly.

The dashboards are designed around the current application telemetry emitted by the API and worker runtimes:

- `runtime_request_duration_seconds` for request volume, latency, error rate, and runtime health
- `invoices_processed_total` for invoice throughput
- `payroll_run_duration_seconds` for payroll execution timing and failure detection
- `forecast_mape_percent` for forecast quality
- `active_users_per_tenant` for tenant activity

## Alert Intent

The alert set is intentionally small and maps to the roadmap requirements:

- p95 API latency above 300ms
- API error rate above 1%
- database connection pressure above 90%
- payroll job failure
- forecast MAPE above 20%

The database pressure rule is the only alert that depends on an external PostgreSQL exporter or equivalent DB pressure signal. That is a deliberate hybrid boundary choice rather than a missing repo contract.

## Helm Boundary

The Helm chart in `infra/helm/amdox` remains app-tier only. It consumes the runtime telemetry wiring, but does not own the Grafana or Prometheus assets.

## Operator Notes

Use these files as the source of truth for the Phase 18 observability contract. If the emitted metric names or scrape labels change, update the dashboards and alert rules here in the same change.
