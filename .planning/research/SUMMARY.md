# Research Summary: Amdox Cloud ERP Platform

## Key Findings

### Stack
The prescribed stack (Turborepo + NestJS + Next.js 15 + Prisma + Keycloak + TimescaleDB) is well-aligned with 2025 enterprise best practices. NestJS's module system maps perfectly to ERP domains (Finance, HR, Supply Chain). Prisma Extensions/middleware provide the tenant isolation layer. Keycloak handles the complex IAM requirements without per-user SaaS pricing.

### Table Stakes
- General Ledger with double-entry bookkeeping
- AP/AR with invoice management and aging reports  
- HR lifecycle + leave management + payroll processing
- Multi-warehouse inventory with PO lifecycle
- Multi-tenant isolation, RBAC, SSO, full audit trail
- Data export (CSV/Excel) on all list views

### Differentiators  
- AI-powered invoice OCR with 3-way matching
- Demand forecasting (Prophet/LSTM) with MAPE quality gating
- Drag-and-drop BI dashboard builder
- Gantt chart project management with DAG validation
- GDPR compliance tooling (data access, erasure, retention)
- PWA offline support

### Watch Out For
1. **Cross-tenant data leakage** — Enforce at 3 layers: JWT → Guard → Prisma middleware → PostgreSQL RLS
2. **Floating point money** — Store as integers (cents); use Prisma Decimal
3. **Unbalanced journal entries** — Validate before write, CHECK constraint backup
4. **Payroll errors** — Extensive test suite against known-good scenarios
5. **Inventory race conditions** — Pessimistic locking on stock updates
6. **N+1 queries** — Use Prisma includes; DataLoader for GraphQL
7. **BullMQ saga failures** — Compensation pattern with rollback for payroll/GL

### Architecture Decision
Modular monolith is the correct starting point. Each NestJS module (Finance, HR, SupplyChain, etc.) has clear boundaries. Extract to microservices only when scaling demands it. The ML service is already a separate Python process by necessity.

## Files

- `STACK.md` — Technology recommendations with versions and rationale
- `FEATURES.md` — Table stakes, differentiators, anti-features with complexity ratings
- `ARCHITECTURE.md` — Component boundaries, data flows, build order, tenancy strategy
- `PITFALLS.md` — 12 identified risks with severity, prevention, and phase mapping

---
*Synthesized: 2026-04-09*
