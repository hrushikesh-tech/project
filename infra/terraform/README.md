# Terraform Platform Foundation

This directory owns the Phase 18 AWS foundation and platform glue boundary.

Terraform is responsible for the managed AWS side of the platform:

- EKS for the cluster and managed node groups
- Aurora PostgreSQL for the primary relational backend
- ElastiCache Redis for queueing, caching, and runtime coordination
- S3 for application artifacts and document storage
- WAF for edge protection and rate limiting
- IAM / IRSA roles for Kubernetes service accounts that need AWS access
- S3 lifecycle and bucket policy seams that keep storage behavior explicit

Terraform does not own application deployment. Helm and ArgoCD remain the owners of:

- Deployments, Services, Ingress, and app configuration
- image rollout and release promotion
- app-level secret mounting and runtime selection

## Layout

- `main.tf` wires the root modules together
- `providers.tf` defines the AWS and TLS providers
- `variables.tf` defines the environment contract
- `outputs.tf` exposes the platform hand-off values
- `modules/eks` provisions the cluster and node group foundation
- `modules/aurora` provisions the database foundation
- `modules/elasticache` provisions Redis
- `modules/s3` provisions storage, encryption, and lifecycle rules
- `modules/waf` provisions WAF and an optional association seam
- `modules/iam` provisions IRSA roles for app service accounts
- `environments/staging.tfvars` and `environments/prod.tfvars` hold environment-specific inputs

## What The Outputs Are For

The root outputs are meant to be consumed by the rest of the platform, not copied into a second deployment system:

- `platform_contract` gives a compact hand-off bundle
- `service_account_role_annotations` gives Helm the IRSA annotation values for app workloads
- endpoint and bucket outputs give the app runtime the exact managed-service coordinates

## Validation

Run these commands from `infra/terraform` after setting real AWS credentials and environment inputs:

```powershell
terraform fmt -check
terraform validate
terraform plan -var-file=environments/staging.tfvars
terraform plan -var-file=environments/prod.tfvars
```

The WAF association is intentionally optional here. The edge resource ARN can be wired later when the ingress or load-balancing target exists in the environment.
