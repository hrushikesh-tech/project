# Architecture

## Scope

This document maps the current monorepo architecture with emphasis on the Phase 3 finance implementation in `apps/api`. The focus is the runtime path from authenticated request to persisted ledger data, reporting, FX lookup, and tests.

## Monorepo Overview

- `apps/api`: NestJS backend. Owns authentication, request guards, Prisma access, and the Phase 3 finance API.
- `apps/web`: Next.js frontend shell. It is currently not wired to the finance API and does not exercise Phase 3 behavior.
- `packages/db`: Prisma schema, generated client exports, and tenant-scoped Prisma extension factory.
- `packages/types`: shared enums, exceptions, and finance report types used by the API and tests.

## Runtime Flow For Finance Requests

1. Request enters `apps/api` through Nest controllers under `apps/api/src/finance`.
2. Global guards in `apps/api/src/app.module.ts` apply:
   - `JwtAuthGuard` validates the bearer token.
   - `TenantGuard` resolves tenant context from JWT claims and stores `tenantId` in CLS.
   - `RolesGuard` applies role checks where decorators exist.
3. `PrismaService` reads `tenantId` from CLS:
   - `prisma.tenant` returns a Prisma client extended with tenant filtering and soft-delete behavior.
   - `prisma.raw` returns the unscoped Prisma client for cross-tenant or framework-level operations.
4. `FinanceService` coordinates ledger rules:
   - legal-entity existence checks
   - account and period validation
   - balanced journal validation
   - posted-entry immutability
   - reversal creation
   - report aggregation
   - intercompany transfer orchestration
5. `FxRatesService` resolves FX rates:
   - Redis cache lookup
   - `FxRate` table lookup
   - OpenExchangeRates fetch fallback
   - persistence back to DB and 24h cache
6. Responses are normalized through `finance.serialization.ts` to make `BigInt` and Prisma decimal values API-safe.

## Finance Module Composition

`apps/api/src/finance/finance.module.ts` is a vertical slice module. It exposes separate controllers for:

- legal entities
- accounts
- fiscal periods
- journal entries
- FX rates
- reports
- intercompany transfers

The module has two services:

- `FinanceService`: core business orchestration and reporting
- `FxRatesService`: rate retrieval, persistence, caching, and scheduled refresh

The module also installs a finance-specific exception filter that maps shared finance exceptions into HTTP responses.

## Data Ownership

### Source of truth

- The ledger source of truth is in `packages/db/prisma/schema.prisma`.
- `LegalEntity`, `Account`, `FiscalPeriod`, `JournalEntry`, `JournalLine`, `IntercompanyTransfer`, and `FxRate` carry the finance domain.

### Money model

- Stored monetary values are `BigInt` minor units in the schema.
- `JournalLine.debit` and `credit` store base-currency normalized amounts.
- `JournalLine.transactionDebit` and `transactionCredit` preserve original transaction currency amounts.
- `JournalLine.fxRate` stores the locked posting rate used for normalization.

This design is consistent with Phase 3’s requirement that reports remain stable after posting even if later FX rates change.

## Package Interaction Map

### `apps/api` -> `packages/db`

- Imports Prisma enums and `PrismaClient`.
- Uses `createTenantClient()` indirectly through `PrismaService`.
- Depends on schema-generated delegates and model names being stable.

### `apps/api` -> `packages/types`

- Uses `JournalEntryStatus` from shared types instead of relying on generated runtime enums in all code paths.
- Uses finance exceptions:
  - `UnbalancedEntryException`
  - `PeriodClosedException`
  - `PostedEntryImmutableException`
  - `MissingFxRateException`

### `apps/api/test` -> built `apps/api/dist`

- Unit and integration tests import compiled JS from `apps/api/dist`.
- Tests do not run directly against TypeScript source.
- Integration tests replace `PrismaService`, `ClsService`, and `ConfigService` with in-memory doubles.

### `apps/web` -> current state

- No current runtime integration with finance APIs.
- Web remains a placeholder shell, so Phase 3 is backend-complete but not user-facing in the frontend.

## End-to-End Status For Phase 3

Phase 3 is structurally implemented end to end inside the backend:

- authenticated request -> tenant context -> finance controller -> finance service -> Prisma -> schema models
- reporting -> aggregated journal lines scoped by legal entity and date range
- FX -> Redis/DB/provider fallback path
- intercompany transfer -> dual posted journal entries plus transfer correlation record

What is verified in-code:

- unit tests for balancing, period close, immutability/reversal, and FX fallback order
- integration tests for resource creation, posting, reporting, FX endpoint behavior, and intercompany transfers
- build-time package linkage across `@amdox/api`, `@amdox/db`, and `@amdox/types`

## Architectural Risks

### 1. `FinanceService` is too large

`apps/api/src/finance/finance.service.ts` owns CRUD, posting workflow, reporting, FX-driven conversion, and intercompany transfers in one class. This increases change risk and makes future Phase 4+ finance work harder to isolate. The code works, but the service is already beyond a comfortable orchestration boundary.

### 2. Mixed use of `prisma.tenant` and `prisma.raw`

The finance path relies on both scoped and unscoped Prisma clients. This is necessary for some framework-level operations, but it means data isolation correctness depends on developers consistently knowing when raw access is safe. Any accidental `raw` usage in request paths can bypass tenant protections.

### 3. Super-admin wildcard behavior is broad

`JwtStrategy` upgrades both `super_admin` and `admin` roles to wildcard tenant access. That is a strong architectural decision. If plain tenant admins were expected to remain tenant-bound, this is an authorization bug rather than a convenience.

### 4. `createLegalEntity()` can auto-resolve wildcard tenants and bootstrap a tenant

When tenant context is `*`, finance logic selects the first tenant and can auto-create a system tenant if none exists. That makes the finance module responsible for tenancy bootstrap, which is an infrastructure concern leaking into the domain layer.

### 5. Integration tests depend on the shape of the in-memory harness

The harness in `apps/api/test/helpers/finance-test-store.mjs` must mimic both `prisma.tenant` and `prisma.raw`. A mismatch already surfaced during verification. This is a useful fast test strategy, but it carries drift risk versus real Prisma + Postgres.

### 6. External FX provider path is not fully proven locally without credentials

The code supports OpenExchangeRates, DB persistence, and Redis caching. The architecture is correct, but live provider verification depends on `OPENEXCHANGE_APP_ID` being configured in the environment.

### 7. Web package does not validate finance workflows

`apps/web` is currently a placeholder page. No frontend integration exists for Phase 3. Backend completion is real, but there is no user-facing workflow validating those endpoints through the web app.

### 8. Debug logging is still in request-path code

`FinanceService` and `JwtStrategy` still contain `console.log` trace output. This is acceptable during bring-up, but it is a production concern for noisy logs and accidental data exposure.

## Recommended Next Refactors

- Split `FinanceService` into smaller domain services:
  - ledger/journal workflow
  - reporting
  - intercompany transfers
  - legal-entity/account/period administration
- Restrict wildcard tenant behavior to `super_admin` only unless the product explicitly wants system-wide `admin`.
- Keep `prisma.raw` usage confined to infrastructure services and scheduled jobs.
- Add at least one finance smoke test against real Postgres + Redis rather than only the in-memory harness.
- Remove request-path trace logging once verification is complete.
