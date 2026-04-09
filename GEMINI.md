<!-- GSD:project-start source:PROJECT.md -->
## Project

**Amdox Technologies — AI-Powered Cloud ERP Suite**

A production-grade, multi-tenant, cloud-native Enterprise Resource Planning (ERP) platform for mid-market and enterprise organisations. It unifies Finance (GL, AP/AR), HR & Payroll, Supply Chain & Inventory, Project Management, AI-powered Demand Forecasting, and Business Intelligence into a single cohesive system with enterprise-grade security, compliance, and observability.

**Core Value:** Every financial transaction is accurately recorded, balanced, and auditable — the General Ledger is the foundation that every other module depends on. If the GL is wrong, the entire ERP is untrustworthy.

### Constraints

- **Tech stack**: Turborepo + NestJS + Next.js 15 + FastAPI — prescribed by master prompt, non-negotiable
- **Security**: OWASP Top 10, SOC 2, GDPR, ISO 27001 — every control is non-negotiable
- **Performance**: P95 < 300ms, 2,000 concurrent users per tenant — SLA targets
- **Testing**: Unit ≥80% coverage, integration + E2E + load testing — enforced in CI
- **Secrets**: Zero hardcoded secrets ever — env vars or secrets manager only
- **Build order**: 18 phases must be built sequentially (each depends on previous)
- **Quality**: No stubs, no TODOs left behind — production-grade from day one
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
