# Amdox Helm Chart

This chart deploys the Amdox application tier only. It owns `web`, `api`, `api-worker`, `ml-service`, and the Kubernetes resources needed to run them safely.

## External Dependencies

The chart intentionally treats the following systems as external:

- PostgreSQL / TimescaleDB
- Redis
- Keycloak
- Elasticsearch
- Object storage / S3
- OTLP collector

Phase 18 keeps those dependencies on the Terraform side of the boundary. Terraform provisions the managed AWS resources and outputs the runtime hand-off values, while this chart continues to own only the Kubernetes app tier.

Those integrations are consumed through `values` plus Kubernetes `Secret` references. The chart does not ship subcharts for those services.

Repo-owned Prometheus alerts and Grafana dashboards live under `infra/observability/`. Keep that surface aligned with the telemetry contract emitted by the app tier; this chart should only continue to expose the app metrics endpoint and OTLP wiring that those assets depend on.

## Values And Secrets

Use `values.yaml` as the shared base contract and layer one environment file on top:

- `values-dev.yaml`
- `values-staging.yaml`
- `values-prod.yaml`

Non-secret runtime configuration is emitted through the chart `ConfigMap`. Secret material should come from the secret named by `global.secretName`.

For AWS-backed runtime wiring, consume the Terraform outputs rather than reintroducing cloud ownership here:

- `s3_bucket_name`
- `aurora_endpoint`
- `elasticache_primary_endpoint`
- `service_account_role_annotations`

Expected `Secret` keys include:

- `DATABASE_URL`
- `REDIS_URL`
- `KEYCLOAK_CLIENT_SECRET`
- `OPENEXCHANGE_APP_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SMTP_PASS`

The placeholder secret template exists only to document the key contract. Replace it with a real cluster-managed `Secret` before production use.

## Workloads

- `web` serves the Next.js frontend on the public app host
- `api` serves the NestJS HTTP workload on the public API host
- `api-worker` runs BullMQ processors and app-owned schedules with `APP_RUNTIME=worker`
- `ml-service` stays internal-only behind a ClusterIP `Service`

The worker split is deliberate: request traffic should not scale background jobs indirectly.

## Deployment Flow

Render the chart with:

```powershell
helm template amdox infra/helm/amdox -f infra/helm/amdox/values-dev.yaml
helm template amdox infra/helm/amdox -f infra/helm/amdox/values-staging.yaml
helm template amdox infra/helm/amdox -f infra/helm/amdox/values-prod.yaml
```

Then deploy with the matching overlay for the target environment.

## Ingress And TLS

The chart exposes only:

- the `web` host
- the `api` host

Auth remains external. Do not add Keycloak or admin ingress resources to this chart in Phase 16.

TLS secret references are values-driven through `ingress.tls.secretName`.

## Image And Tag Updates

Each workload image is configured independently:

- `web.image`
- `api.image`
- `api.canary.image`
- `apiWorker.image`
- `mlService.image`

Update image repositories or tags in the base values or the environment overlays, depending on whether the change is global or environment-specific.

## Rollback

The primary rollback paths are:

- revert the Helm release to the previous revision
- point image tags back to the last known-good build
- disable or retag the API canary while keeping the stable API deployment intact

Because dependencies are external, chart rollback focuses on app-tier workloads and config, not stateful platform restoration.
