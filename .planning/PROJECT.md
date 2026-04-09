# Amdox Technologies — AI-Powered Cloud ERP Suite

## What This Is

A production-grade, multi-tenant, cloud-native Enterprise Resource Planning (ERP) platform for mid-market and enterprise organisations. It unifies Finance (GL, AP/AR), HR & Payroll, Supply Chain & Inventory, Project Management, AI-powered Demand Forecasting, and Business Intelligence into a single cohesive system with enterprise-grade security, compliance, and observability.

## Core Value

Every financial transaction is accurately recorded, balanced, and auditable — the General Ledger is the foundation that every other module depends on. If the GL is wrong, the entire ERP is untrustworthy.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Multi-tenant isolation with row-level security on every table
- [ ] SSO authentication via Keycloak with RBAC and MFA enforcement
- [ ] Double-entry General Ledger with period close and multi-currency support
- [ ] AP/AR automation with OCR invoice processing and 3-way matching
- [ ] HR core with org chart, leave management state machine, and attendance
- [ ] Payroll engine with configurable tax slabs and payslip generation
- [ ] Procurement workflow with PO lifecycle and automated reorder
- [ ] FIFO/AVCO inventory costing across multiple warehouses
- [ ] AI/ML demand forecasting (Prophet primary, LSTM secondary) with MAPE gating
- [ ] Drag-and-drop BI dashboard builder with real-time SSE refresh
- [ ] Project management with DAG-validated task dependencies and Gantt charts
- [ ] Event-driven notification engine (in-app, email, SMS, webhook) via outbox pattern
- [ ] Next.js 15 frontend with full WCAG 2.1 AA accessibility
- [ ] GraphQL layer for BI aggregation queries with DataLoader
- [ ] OWASP Top 10 + SOC 2 + GDPR + ISO 27001 security controls
- [ ] Comprehensive testing (unit ≥80%, integration, E2E, k6 load)
- [ ] Kubernetes deployment with Helm, Istio, ArgoCD GitOps
- [ ] CI/CD via GitHub Actions with security scanning gates
- [ ] OpenTelemetry observability with Prometheus + Grafana
- [ ] AWS cloud infrastructure via Terraform (EKS, Aurora, ElastiCache, S3, WAF)
- [ ] GDPR data subject rights (access, erasure, retention policies)
- [ ] Full documentation (README, ADRs, OpenAPI 3.1)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Mobile native apps — Web-first PWA approach covers mobile needs for v1
- CRM module — Not part of initial ERP scope; integrate third-party if needed
- E-commerce storefront — ERP backend only, no customer-facing storefront
- Custom report builder (end-user SQL) — Security risk; pre-built metrics + dashboard builder sufficient
- Multi-region deployment — Single-region AWS deployment for v1; multi-region in future milestone

## Context

**Project code:** AMX-ERP-2026-04

**Target stack:**
- **Monorepo:** Turborepo with pnpm workspaces
- **Frontend:** Next.js 15 (App Router) + shadcn/ui + TanStack Query + Zustand
- **Backend:** NestJS 11 (TypeScript) — modular monolith
- **ML Service:** Python 3.13 FastAPI (Prophet + PyTorch LSTM)
- **Database:** TimescaleDB (PostgreSQL 17) via Prisma ORM
- **Auth:** Keycloak 25 (OIDC/SAML, RBAC, MFA)
- **Cache/Queue:** Redis 8 + BullMQ
- **Search:** Elasticsearch 8.15
- **Infrastructure:** Docker Compose (dev), Kubernetes + Helm + Istio (prod), Terraform (AWS)
- **CI/CD:** GitHub Actions + ArgoCD
- **Observability:** OpenTelemetry + Prometheus + Grafana

**Target SLAs:**
- 99.9% uptime
- < 300ms P95 API latency
- ≥ 2,000 concurrent users per tenant

**Security compliance:** OWASP Top 10 2021, SOC 2 Type II, GDPR, ISO 27001

**Existing code:** There is legacy Express.js backend and React frontend code in the repository. The master prompt instructs building from scratch with the new stack — legacy code will be replaced entirely.

## Constraints

- **Tech stack**: Turborepo + NestJS + Next.js 15 + FastAPI — prescribed by master prompt, non-negotiable
- **Security**: OWASP Top 10, SOC 2, GDPR, ISO 27001 — every control is non-negotiable
- **Performance**: P95 < 300ms, 2,000 concurrent users per tenant — SLA targets
- **Testing**: Unit ≥80% coverage, integration + E2E + load testing — enforced in CI
- **Secrets**: Zero hardcoded secrets ever — env vars or secrets manager only
- **Build order**: 18 phases must be built sequentially (each depends on previous)
- **Quality**: No stubs, no TODOs left behind — production-grade from day one

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Turborepo monorepo over polyrepo | Shared types, unified CI, atomic changes across frontend/backend | — Pending |
| NestJS modular monolith over microservices | Simpler deployment, easier refactoring; can extract services later | — Pending |
| Keycloak over Auth0/Cognito | On-prem flexibility, open source, full control over auth flows | — Pending |
| PostgreSQL (TimescaleDB) over MongoDB | ACID compliance essential for financial data; time-series for audit/forecast | — Pending |
| Prophet primary + LSTM secondary for forecasting | Prophet handles most SKUs well; LSTM for high-volume with 500+ data points | — Pending |
| Outbox pattern for event delivery | Guaranteed delivery over direct event bus; transactional consistency | — Pending |
| Prisma ORM with tenant middleware | Type-safe queries with automatic tenant isolation; impossible to bypass | — Pending |
| BullMQ for job processing | Redis-backed, supports sagas with compensation, cron scheduling | — Pending |
| shadcn/ui + TanStack Query on frontend | Accessible components + server-state management; no Redux needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
