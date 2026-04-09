# Stack Research: Cloud ERP Platform

## Recommended Stack (2025-26)

| Layer | Technology | Version | Confidence |
|-------|-----------|---------|------------|
| **Monorepo** | Turborepo + pnpm | Turborepo 2.x, pnpm 9+ | ⬆️ High |
| **Frontend** | Next.js (App Router) | 15.x | ⬆️ High |
| **UI Components** | shadcn/ui + Radix | Latest | ⬆️ High |
| **State (Server)** | TanStack Query | v5 | ⬆️ High |
| **State (Client)** | Zustand | v4/5 | ⬆️ High |
| **Styling** | Tailwind CSS | v4 | ⬆️ High |
| **Backend** | NestJS | 11.x | ⬆️ High |
| **ORM** | Prisma | 6.x | ⬆️ High |
| **Database** | TimescaleDB (PostgreSQL 17) | 2.x on PG17 | ⬆️ High |
| **Auth/IAM** | Keycloak | 25.x | ⬆️ High |
| **Cache** | Redis | 8.x | ⬆️ High |
| **Job Queue** | BullMQ | 5.x | ⬆️ High |
| **Search** | Elasticsearch | 8.15 | ⬆️ High |
| **ML Service** | Python FastAPI | 0.115+ | ⬆️ High |
| **ML Models** | Prophet + PyTorch | Prophet 1.1, Torch 2.4 | ⬆️ High |
| **Model Registry** | MLflow | 2.16 | ⬆ Medium |
| **Containerization** | Docker | 27.x | ⬆️ High |
| **Orchestration** | Kubernetes + Helm + Istio | k8s 1.31 | ⬆️ High |
| **IaC** | Terraform | 1.9 | ⬆️ High |
| **CI/CD** | GitHub Actions + ArgoCD | Latest | ⬆️ High |
| **Observability** | OpenTelemetry + Prometheus + Grafana | Latest | ⬆️ High |
| **Cloud** | AWS (EKS, Aurora, ElastiCache, S3) | Latest | ⬆️ High |

## Rationale

### Why NestJS over Express
- Built-in module system aligns with DDD (Domain-Driven Design) for ERP modules
- First-class TypeScript support with decorators for guards, pipes, interceptors
- Dependency injection makes testing and swapping implementations easy
- Microservice transport layer built-in (can extract modules later)

### Why Prisma over TypeORM/Drizzle
- Type-safe client auto-generated from schema
- Prisma Middleware/Extensions perfect for tenant isolation injection
- Migration system with `prisma migrate` for schema versioning
- Strong ecosystem and documentation

### Why Keycloak over Auth0/Cognito
- Open source — no per-user pricing at enterprise scale
- On-prem deployment option for regulated industries
- Full SAML + OIDC support
- Built-in MFA, brute force detection, password policies
- Realm-based multi-tenancy support

### Why TimescaleDB over plain PostgreSQL
- Hypertable compression for audit logs and time-series forecast data
- Continuous aggregates for real-time BI metrics
- Fully compatible with PostgreSQL (Prisma works seamlessly)
- Purpose-built for the AuditLog and ForecastPrediction tables

### What NOT to Use
- **MongoDB**: Lacks ACID transactions needed for financial data
- **Redux**: Overkill for ERP; TanStack Query handles server state, Zustand for UI state
- **TypeORM**: Prisma offers better type safety and developer experience
- **Passport.js directly**: Keycloak handles auth complexity; NestJS just validates JWTs
- **Kafka**: Overkill for initial deployment; BullMQ + Redis sufficient, can migrate later

---
*Researched: 2026-04-09*
