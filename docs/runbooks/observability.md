# Observability Runbook

This runbook describes the repo-owned observability contract for the current hybrid boundary: app telemetry first, thin infrastructure coverage second.

## What Exists In Repo

- Prometheus alert rules: `infra/observability/prometheus/alerts.yaml`
- Grafana dashboards:
  - `infra/observability/grafana/api-performance.json`
  - `infra/observability/grafana/business-metrics.json`
  - `infra/observability/grafana/infrastructure.json`
- Operator notes: `infra/observability/README.md`

## Metrics To Watch

The current dashboards and alerts are built around these runtime metrics:

- `runtime_request_duration_seconds`
- `invoices_processed_total`
- `payroll_run_duration_seconds`
- `forecast_mape_percent`
- `active_users_per_tenant`

The API and ML service expose Prometheus-compatible metrics at their `/metrics` endpoints. The API also exports spans through the configured OTLP endpoint when `OTEL_EXPORTER_OTLP_ENDPOINT` is present.

## Dashboards

### API Performance

Use this dashboard to check request latency, error rate, and route-level behavior for the NestJS API. It is the first place to start when the API latency alert fires.

### Business Metrics

Use this dashboard for ERP-facing volume and quality signals:

- invoices processed
- payroll duration
- forecast MAPE
- active users per tenant

### Infrastructure

This dashboard is intentionally thin. It exists to provide just enough golden-signal visibility to move from an app symptom to an infrastructure hypothesis without pretending the repo owns full platform observability.

## Alerts

| Alert                           | What It Means                                  | Notes                                                                                      |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AmdoxAPIP95LatencyHigh`        | API p95 latency is above 300ms for 10 minutes. | Start with request path, request ID, and the API Performance dashboard.                    |
| `AmdoxAPIErrorsHigh`            | API error rate is above 1% for 10 minutes.     | Check recent deploys, auth failures, and tenant-scoped requests.                           |
| `AmdoxDBConnectionPressureHigh` | PostgreSQL connection pressure is above 90%.   | This depends on a PostgreSQL exporter or equivalent DB pressure signal in the environment. |
| `AmdoxPayrollJobFailed`         | At least one payroll run failed.               | Investigate the payroll worker path and the latest run trace.                              |
| `AmdoxForecastMAPEHigh`         | Forecast MAPE stayed above 20% for 15 minutes. | Check model type, tenant, product, and training data freshness.                            |

## Investigation Flow

1. Open the alert and read the labels. `scope`, `tenant_id`, `route`, and `outcome` are usually enough to narrow the search.
2. Check the matching Grafana dashboard.
3. Inspect the relevant `/metrics` endpoint.
4. Pull the request or trace ID from the application logs or the alert metadata.
5. Confirm whether the issue is app-level, data-level, or environment-level.

## Dependencies And Caveats

- The database-pressure rule is not fully self-contained in the repo. It needs a live PostgreSQL exporter or equivalent DB signal.
- Dashboard rendering requires Grafana to import the JSON files in `infra/observability/grafana`.
- Live alert evaluation requires Prometheus to scrape the current metrics endpoints.
- The API and ML service must have the telemetry env vars set in the target environment, especially `OTEL_EXPORTER_OTLP_ENDPOINT` and the metrics path settings.

## What To Check During A Real Incident

- API p95 latency and error rate
- payroll job failures
- forecast quality drift
- active-user spikes by tenant
- DB connection pressure before assuming the database itself is unhealthy

If a dashboard or alert no longer matches the emitted metric names, update the observability assets in the same change as the code that changed the metric contract.
