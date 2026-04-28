# Phase 18-02 Summary

## What Changed

Implemented the repo-owned observability surface for the hybrid app-first boundary:

- added Prometheus alert rules in `infra/observability/prometheus/alerts.yaml`
- added `infra/observability/grafana/api-performance.json`
- added `infra/observability/grafana/business-metrics.json`
- added `infra/observability/grafana/infrastructure.json`
- added operator-facing guidance in `infra/observability/README.md`
- updated `infra/helm/amdox/README.md` so the Helm boundary stays aligned with the observability assets

## Validation Notes

The dashboards and alerts are aligned to the current telemetry names emitted by the application runtimes:

- `runtime_request_duration_seconds`
- `invoices_processed_total`
- `payroll_run_duration_seconds`
- `forecast_mape_percent`
- `active_users_per_tenant`

The only non-app signal in the observability set is the database pressure rule, which intentionally depends on an external PostgreSQL exporter or equivalent DB pressure metric. That is the expected hybrid boundary, not a repository gap.

I did not run Grafana import validation or live Prometheus evaluation in this workspace.

## Files Changed

- `infra/observability/prometheus/alerts.yaml`
- `infra/observability/grafana/api-performance.json`
- `infra/observability/grafana/business-metrics.json`
- `infra/observability/grafana/infrastructure.json`
- `infra/observability/README.md`
- `infra/helm/amdox/README.md`
- `.planning/phases/18-observability-cloud-gdpr-documentation/18-02-SUMMARY.md`
