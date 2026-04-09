# Architecture Research: Cloud ERP Platform

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CDN / WAF                            │
│                     (CloudFront + WAF)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Ingress / Load Balancer                   │
│                     (Istio Gateway)                          │
└────────┬─────────────────┬─────────────────┬────────────────┘
         │                 │                 │
┌────────▼──────┐  ┌───────▼───────┐  ┌─────▼────────┐
│   Next.js 15  │  │  NestJS API   │  │  ML Service   │
│   (Frontend)  │  │  (Backend)    │  │  (FastAPI)    │
│   Port 3000   │  │  Port 3001    │  │  Port 8000    │
└───────────────┘  └───┬───┬───┬───┘  └──────┬────────┘
                       │   │   │              │
            ┌──────────┘   │   └──────────┐   │
            │              │              │   │
   ┌────────▼────┐  ┌─────▼─────┐  ┌─────▼───▼──────┐
   │ TimescaleDB  │  │   Redis   │  │ Elasticsearch  │
   │ (PostgreSQL  │  │  (Cache,  │  │   (Search,     │
   │  17 + TS)   │  │   Queue)  │  │    Logging)    │
   └─────────────┘  └───────────┘  └────────────────┘
```

## Component Boundaries

### Frontend (Next.js 15)
- **Responsibility**: UI rendering, client-side routing, auth flow
- **Talks to**: NestJS API (REST), Keycloak (OIDC)
- **Data flow**: TanStack Query fetches → API client → NestJS
- **State**: Server state via TanStack Query, UI state via Zustand

### Backend API (NestJS 11)
- **Responsibility**: Business logic, data validation, event orchestration
- **Module structure**: Finance, HR, SupplyChain, Projects, BI, Notifications, GDPR
- **Talks to**: TimescaleDB (Prisma), Redis (cache + BullMQ), Elasticsearch, ML Service, Keycloak, S3, SES
- **Pattern**: Modular monolith — each module is a NestJS module with clear boundaries

### ML Service (FastAPI)
- **Responsibility**: Model training, inference, model registry
- **Talks to**: NestJS API (HTTP), MLflow (file-based), S3 (model storage)
- **Isolation**: Separate Python process; communicates via REST API only

### Data Flow Patterns

#### Request Flow (Synchronous)
```
Browser → Next.js middleware (auth check) → API Client → NestJS Guard (JWT + Tenant + Role)
→ NestJS Controller → Service → Prisma (with tenant middleware) → TimescaleDB
→ Response envelope → Browser
```

#### Event Flow (Asynchronous — Outbox Pattern)
```
Service method → Prisma transaction {
  1. Write business data
  2. Write OutboxEvent
} → Commit

Outbox Worker (polls every 5s) → Read PENDING events → BullMQ queue
→ Notification Worker → Channel dispatch (email/in-app/webhook)
→ Mark OutboxEvent as PROCESSED
```

#### Job Processing (BullMQ)
```
Cron trigger or API call → BullMQ queue → Worker process
Examples:
- Payroll run (saga with compensation)
- Invoice OCR processing
- Demand forecast retraining
- Leave accrual calculation
- Report generation
```

## Build Order (Dependency-Driven)

```
Phase 0: Monorepo + toolchain (no dependencies)
    ↓
Phase 1: Database schema + Auth (foundational)
    ↓
Phase 2: Finance/GL (depends on DB + Auth)
    ↓
Phase 3: HR + Payroll (depends on GL for salary posting)
    ↓
Phase 4: Supply Chain (depends on GL for COGS posting)
    ↓
Phase 5: ML Service (depends on supply chain data)
    ↓
Phase 6: BI Dashboard (depends on all modules for metrics)
    ↓
Phase 7: Projects (depends on HR for resources, GL for budget)
    ↓
Phase 8: Notifications (cross-cutting, wires into all modules)
    ↓
Phase 9: Frontend (depends on all API modules)
    ↓
Phase 10: API Gateway + GraphQL (API surface polish)
    ↓
Phase 11: Security hardening (applied across all layers)
    ↓
Phase 12: Testing (validates everything above)
    ↓
Phase 13: Docker + Kubernetes (packages everything)
    ↓
Phase 14: CI/CD (automates build + deploy)
    ↓
Phase 15: Observability (monitors production)
    ↓
Phase 16: Cloud deployment (deploys to AWS)
    ↓
Phase 17: GDPR compliance (data governance layer)
    ↓
Phase 18: Documentation (captures everything)
```

## Multi-Tenancy Strategy

**Approach**: Shared database + shared schema + discriminator column (`tenantId`)

**Enforcement layers**:
1. **JWT claim**: `tenant_id` extracted from Keycloak JWT
2. **NestJS TenantGuard**: Injects `tenantId` into request context
3. **Prisma middleware**: Automatically adds `WHERE tenantId = ?` to every query
4. **PostgreSQL RLS**: Database-level backup policy (defense in depth)

**Why not schema-per-tenant**: Operational complexity at scale (migration management across N schemas); column-based with middleware enforcement is industry standard for SaaS ERP.

---
*Researched: 2026-04-09*
