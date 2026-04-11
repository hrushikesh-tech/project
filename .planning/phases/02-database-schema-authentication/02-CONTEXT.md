# Phase 2: Database Schema & Authentication - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the complete Prisma schema with 40+ models, implement multi-tenant middleware with row-level security via Prisma Client Extensions, and build a fully working Keycloak-based auth flow in NestJS with RBAC, MFA, and audit logging. This phase delivers the foundational data layer and security infrastructure that every subsequent module depends on.

Requirements covered: DB-01, DB-02, DB-03, DB-04, DB-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10

</domain>

<decisions>
## Implementation Decisions

### Schema Design
- **D-01:** Schema file organization is at the agent's discretion — choose the best approach based on Prisma 6.x capabilities and maintainability for 40+ models.
- **D-02:** Soft deletes enforced via Prisma middleware/extension. Every model with `deletedAt` gets automatic interception: `delete` → sets `deletedAt`, all queries automatically filter `WHERE deletedAt IS NULL`. Zero chance of accidental hard-delete.
- **D-03:** Hybrid enum strategy — Prisma native enums for stable, rarely-changing values (account types: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE, user roles, notification channels). String fields with TypeScript enums for evolving workflow statuses (PO lifecycle, leave states, invoice statuses) to avoid migration churn.

### Multi-Tenant Architecture
- **D-04:** Shared schema with tenant middleware. All tenants share one database. Prisma middleware injects `WHERE tenantId = X` into every query. Standard SaaS ERP approach — cost-effective, simple migrations, single schema evolution.
- **D-05:** Prisma Client Extensions (modern `$extends()` API) for tenant injection. Not the deprecated `$use()` middleware. Creates a tenant-scoped client per request. Composable, officially supported by Prisma 5+/6.x.
- **D-06:** SuperAdmin access uses a wildcard `tenantId = *` convention. When the request carries this marker, the tenant extension omits the tenant filter. Explicit, auditable, no silent bypass. Every cross-tenant access is traceable.

### Keycloak Integration
- **D-07:** Realm provisioned via JSON realm import file (`realm-export.json`). Defines all roles (super_admin, tenant_admin, finance_manager, hr_manager, supply_chain_manager, project_manager, viewer), OIDC clients (amdox-web public PKCE, amdox-api confidential), MFA policies, password policies, and brute-force detection. Version-controlled, reproducible, one-command setup.
- **D-08:** Keycloak gets its own database (`keycloak_db`) on the same TimescaleDB instance. Cleaner isolation — Keycloak's 90+ internal tables don't pollute the ERP Prisma schema. Separate migration paths.
- **D-09:** JWT custom claims via Keycloak protocol mapper. A mapper in the realm config injects `tenant_id` as a JWT claim from a user attribute. NestJS extracts `tenant_id` directly from the token — no extra DB lookup per request.

### Audit Logging
- **D-10:** Full record clone for audit snapshots. Complete before and after state stored as JSON columns in AuditLog table. Full records required for financial compliance — auditors need complete state at any point in time, not reconstructed diffs.
- **D-11:** Mutations only (POST, PUT, PATCH, DELETE). Read operations are not audited — too much noise and not required by AUTH-09. Standard ERP audit scope.
- **D-12:** AuditLog stored in TimescaleDB hypertable with automatic compression after 30 days. Native PostgreSQL, queryable via Prisma, aligns with DB-03 requirement. No secondary storage (Elasticsearch) for audit — single source of truth.

### Agent's Discretion
- Schema file organization approach (D-01)
- NestJS module structure for auth (guards, interceptors, decorators)
- Prisma seed data strategy for development

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Architecture
- `.planning/PROJECT.md` — Core value, tech stack, non-negotiable constraints
- `.planning/REQUIREMENTS.md` §Database & Schema (DB) — DB-01 through DB-05 acceptance criteria
- `.planning/REQUIREMENTS.md` §Authentication & Authorization (AUTH) — AUTH-01 through AUTH-10 acceptance criteria
- `.planning/ROADMAP.md` §Phase 2 — Success criteria and dependencies

### Phase 1 Foundation
- `apps/api/src/main.ts` — Current NestJS entry point (minimal AppModule)
- `apps/api/tsconfig.json` — API TypeScript configuration
- `packages/db/package.json` — Database package (currently empty — Prisma goes here)
- `docker-compose.yml` — TimescaleDB, Redis, Keycloak service definitions
- `.env.example` — Environment variable documentation

### External Documentation
- Prisma 6.x Client Extensions: https://www.prisma.io/docs/orm/prisma-client/client-extensions
- Keycloak 25 realm export format: https://www.keycloak.org/docs/25.0/server_admin/#_export_import
- NestJS Guards and Interceptors: https://docs.nestjs.com/guards

No project-internal ADRs or specs exist yet — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/main.ts` — Minimal NestJS bootstrap, needs modular expansion with ConfigModule, auth modules
- `packages/db/` — Empty package, ready for Prisma schema and client generation
- `packages/types/` — Empty package, ready for shared TypeScript types/enums
- `packages/config/base.json` — Shared TypeScript base configuration

### Established Patterns
- Turborepo workspace linking via `pnpm` — packages reference each other as `@amdox/*`
- ESLint 10 flat config with shared rules in `packages/config/eslint-config.mjs`
- Docker Compose for local infrastructure services

### Integration Points
- `packages/db` will export the Prisma client consumed by `apps/api`
- `packages/types` will export shared enums/interfaces used by both `apps/api` and `apps/web`
- `docker-compose.yml` needs a second database (`keycloak_db`) added to TimescaleDB init
- `.env.example` needs Keycloak realm and client configuration variables

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above. The requirements document (DB-01 through DB-05, AUTH-01 through AUTH-10) is highly prescriptive and provides exact field names, role names, policies, and behaviors.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-database-schema-authentication*
*Context gathered: 2026-04-12*
