# Phase 2: Database Schema & Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 02-database-schema-authentication
**Areas discussed:** Schema Design Strategy, Multi-Tenant Architecture, Keycloak Integration Approach, Audit Logging Depth

---

## Schema Design Strategy

### Schema File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single schema.prisma | Everything in one file — simpler tooling, Prisma's native approach | |
| Multi-file split by domain | Separate files per module, requires prismaSchemaFolder preview feature | |
| Agent's discretion | Let the agent pick based on Prisma 6.x capabilities | ✓ |

**User's choice:** Agent's discretion
**Notes:** User deferred this technical decision to the agent.

### Soft Delete Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma middleware/extension | Automatic interception — delete → sets deletedAt, queries filter NULL | ✓ |
| Manual service-layer handling | Each service explicitly filters by deletedAt | |

**User's choice:** Prisma middleware/extension
**Notes:** Foolproof approach for ERP — zero chance of accidental hard-delete.

### Enum Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma native enums | DB-level enforcement, requires migration to add values | |
| String fields with TS enums | Flexible, no migration needed, but no DB enforcement | |
| Hybrid | Prisma enums for stable values, strings for evolving statuses | ✓ |

**User's choice:** Hybrid
**Notes:** Prisma enums for account types, roles, channels. String fields for PO lifecycle, leave states, invoice statuses.

---

## Multi-Tenant Architecture

### Tenant Isolation Model

| Option | Description | Selected |
|--------|-------------|----------|
| Shared schema with tenant middleware | All tenants share one DB, middleware injects WHERE tenantId = X | ✓ |
| Database-per-tenant | Each tenant gets isolated database | |
| Schema-per-tenant | Same instance, separate PostgreSQL schemas | |

**User's choice:** Shared schema with tenant middleware
**Notes:** Standard SaaS ERP approach — cost-effective, simple migrations.

### Middleware Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Prisma Client Extensions | Modern $extends() API, composable, officially supported | ✓ |
| Prisma Middleware (legacy) | $use() interceptor, deprecated | |
| PostgreSQL RLS | Database-enforced via SET app.current_tenant | |

**User's choice:** Prisma Client Extensions
**Notes:** Modern approach, composable, officially supported by Prisma 5+/6.x.

### SuperAdmin Access

| Option | Description | Selected |
|--------|-------------|----------|
| Bypass middleware entirely | Skip tenant filtering for super_admin role | |
| Wildcard tenantId = * | Special marker, middleware omits filter when present | ✓ |
| Separate unscoped Prisma client | Different client instance without tenant middleware | |

**User's choice:** Wildcard tenantId = * convention
**Notes:** Explicit and auditable — every cross-tenant access is traceable.

---

## Keycloak Integration Approach

### Realm Provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| JSON realm import file | Auto-imports on Keycloak start, version-controlled, reproducible | ✓ |
| Programmatic setup via Admin API | NestJS seeder script calls Admin API | |
| Manual setup | Developer configures via admin UI | |

**User's choice:** JSON realm import file
**Notes:** One-command setup, reproducible across environments.

### Keycloak Database

| Option | Description | Selected |
|--------|-------------|----------|
| Separate database on same instance | Add keycloak_db database in TimescaleDB | ✓ |
| Shared database | Keep Keycloak in amdox_erp database | |
| Separate PostgreSQL container | Second PostgreSQL container for Keycloak | |

**User's choice:** Separate database on same instance
**Notes:** Cleaner isolation — Keycloak's 90+ tables don't pollute ERP Prisma schema.

### JWT Custom Claims

| Option | Description | Selected |
|--------|-------------|----------|
| Keycloak protocol mapper | Injects tenant_id as JWT claim from user attribute | ✓ |
| Lookup at API layer | NestJS queries DB for user's tenant per request | |

**User's choice:** Keycloak protocol mapper
**Notes:** No extra DB lookup per request — tenant_id directly in token.

---

## Audit Logging Depth

### Snapshot Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full record clone | Complete before/after state as JSON | ✓ |
| Diff-only | Only changed fields in JSON patch format | |
| Hybrid | Full for financial models, diff for others | |

**User's choice:** Full record clone
**Notes:** Financial compliance requires complete state at any point in time.

### What Gets Audited

| Option | Description | Selected |
|--------|-------------|----------|
| Mutations only | POST, PUT, PATCH, DELETE | ✓ |
| Mutations + sensitive reads | Also log reads of financial/personal data | |
| Everything | All operations | |

**User's choice:** Mutations only
**Notes:** Matches AUTH-09 requirement exactly. Reads generate too much noise.

### Audit Log Storage

| Option | Description | Selected |
|--------|-------------|----------|
| TimescaleDB hypertable | Automatic compression after 30 days, queryable via Prisma | ✓ |
| Elasticsearch | Full-text search and analytics | |
| Both | TimescaleDB primary, async-replicate to Elasticsearch | |

**User's choice:** TimescaleDB hypertable
**Notes:** Single source of truth, aligns with DB-03 requirement.

---

## Agent's Discretion

- Schema file organization approach (single vs multi-file)
- NestJS module structure for auth (guards, interceptors, decorators)
- Prisma seed data strategy for development

## Deferred Ideas

None — discussion stayed within phase scope.
