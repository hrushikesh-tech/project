# Phase 18-05 Summary

## What Changed

Closed out the documentation portion of Phase 18 with balanced platform docs that match the implemented system:

- added a root `README.md` with setup, scripts, architecture, environment, deployment, and documentation entry points
- added `docs/architecture/overview.md` with the current runtime and deployment relationships
- added `docs/runbooks/observability.md` for dashboards, alerts, dependencies, and investigation steps
- added `docs/runbooks/gdpr-operations.md` for export, erasure, retention, and manual verification boundaries
- added a six-ADR set under `docs/adr/`
- added `docs/adr/README.md` as a navigation index

## Truthfulness Notes

The docs were written from the current code and infrastructure seams, not from the original aspirational roadmap text.

- the API docs behavior is documented as OpenAPI 3.1 with `/api-docs` and `/api-docs-json`
- the observability runbook calls out the thin hybrid boundary and the database-pressure dependency on a live exporter or equivalent signal
- the GDPR runbook notes that the current request flow is handled inline in the API service

I did not need to change `apps/api/src/common/api/api-docs.ts`; the current implementation already matches the documentation contract closely enough to document truthfully.

## Validation

Planned documentation sanity checks were run after the edits:

- root docs now reference setup, architecture, environment, deployment, dashboards, alerts, export, erasure, retention, and `/api-docs`
- the API docs seam still exposes OpenAPI publication through `DocumentBuilder` and `SwaggerModule`

I did not run environment-specific verification for Grafana, Prometheus, AWS, or live GDPR workflows in this workspace.

## Files Changed

- `README.md`
- `docs/architecture/overview.md`
- `docs/runbooks/observability.md`
- `docs/runbooks/gdpr-operations.md`
- `docs/adr/README.md`
- `docs/adr/0001-turborepo-monorepo.md`
- `docs/adr/0002-nestjs-modular-monolith.md`
- `docs/adr/0003-keycloak-authentication.md`
- `docs/adr/0004-postgresql-timescaledb.md`
- `docs/adr/0005-prophet-lstm-forecasting.md`
- `docs/adr/0006-outbox-event-delivery.md`
- `.planning/phases/18-observability-cloud-gdpr-documentation/18-05-SUMMARY.md`
