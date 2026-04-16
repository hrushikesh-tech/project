# Structure

## Repository Shape

Current monorepo layout relevant to Phase 3:

- `apps/api`: backend runtime
- `apps/web`: frontend shell
- `packages/db`: Prisma schema and client package
- `packages/types`: shared type package
- `.planning`: planning and codebase documentation

## Phase 3 Finance Paths

### API package

Primary finance implementation lives under `apps/api/src/finance`:

- `finance.module.ts`
- `finance.service.ts`
- `fx-rates.service.ts`
- `finance-*.controller.ts`
- `dto/*`
- `finance-exception.filter.ts`
- `finance.serialization.ts`

This is a vertical module, but most business logic is concentrated in `finance.service.ts`.

### Prisma integration

Database access is split across:

- `apps/api/src/prisma/prisma.service.ts`
- `packages/db/src/client.ts`
- `packages/db/src/extensions/tenant.extension.ts`
- `packages/db/src/extensions/soft-delete.extension.ts`
- `packages/db/prisma/schema.prisma`

Structural pattern:

- `PrismaService` owns the base `PrismaClient`
- `createTenantClient()` applies tenant and soft-delete extensions
- request-scoped finance code usually uses `prisma.tenant`
- framework or cross-tenant code uses `prisma.raw`

### Shared packages

`packages/db` exposes:

- generated Prisma client and enums
- tenant client factory
- Prisma extensions

`packages/types` exposes:

- shared enums
- Phase 3 finance exceptions
- finance report interfaces

This creates a clean dependency direction:

- `apps/api` depends on `packages/db` and `packages/types`
- `packages/db` and `packages/types` do not depend on app code

## Request Structure

Finance HTTP endpoints are mounted under `/api/v1/finance/...` via dedicated controllers:

- entities
- accounts
- periods
- journal entries
- FX rates
- reports
- intercompany transfers

The request path is:

1. Nest controller validates DTO
2. global auth and tenant guards populate request user and CLS tenant context
3. finance service executes domain rules
4. Prisma persists or queries models
5. serializer normalizes non-JSON-safe values

## Data Structure

Phase 3 finance storage centers on these Prisma models:

- `Tenant`
- `LegalEntity`
- `Account`
- `FiscalPeriod`
- `JournalEntry`
- `JournalLine`
- `IntercompanyTransfer`
- `FxRate`

Important structural relationships:

- `Tenant` -> many `LegalEntity`
- `LegalEntity` -> many `Account`, `FiscalPeriod`, `JournalEntry`
- `JournalEntry` -> many `JournalLine`
- `JournalEntry` -> optional self-link for reversal
- `IntercompanyTransfer` -> one source entry and one destination entry
- `FxRate` -> tenant/date/currency-pair keyed lookup table

## Test Structure

Finance tests live under `apps/api/test`:

- `unit/finance.service.test.mjs`
- `integration/finance.api.test.mjs`
- `helpers/finance-test-store.mjs`

Structural characteristics:

- tests run with Node’s built-in test runner
- integration tests use Nest testing module + Supertest
- tests import built output from `apps/api/dist`
- the harness replaces Prisma, CLS, and config dependencies in memory

This is fast and isolated, but it means the structural contract between production services and the harness must stay aligned.

## Web Package Structure

`apps/web` currently contains:

- `app/layout.tsx`
- `app/page.tsx`
- `tsconfig.json`
- `package.json`

It is structurally independent from Phase 3 finance. There is no finance client, no shared API contract layer, and no dashboard/reporting UI consuming the backend module yet.

## Notable Structural Couplings

### Tight coupling to CLS tenant context

Finance service methods assume CLS tenant state is always available. This is correct for authenticated request paths but creates extra care points for tests, scripts, jobs, or future message consumers.

### Tight coupling to Prisma delegate names

The harness and the service both rely on concrete Prisma delegate names like `legalEntity`, `fxRate`, `journalEntry`, and `fiscalPeriod`. Schema renames or Prisma regeneration changes will require synchronized updates across runtime and tests.

### Dist-based test imports

Tests depend on `apps/api/dist` rather than source. This makes build order part of the structure. If the build is stale, tests can validate old code.

### Next.js generated artifact noise

`apps/web/.next` artifacts are present in the workspace and can affect repo hygiene and TypeScript behavior if not excluded carefully. This is not a finance defect, but it is a structural maintenance risk.

## End-to-End Structural Assessment

Phase 3 is structurally coherent inside the backend:

- schema supports the ledger domain
- API module aligns to that schema
- shared exceptions/types are consumed consistently
- tests exercise the main service and HTTP paths

Phase 3 is not structurally complete across the full product surface because:

- `apps/web` does not consume finance APIs
- external FX verification still depends on environment credentials
- tests do not yet include a real Postgres + Redis integration layer

## Files Added Or Updated Most Relevant To Phase 3

- `apps/api/src/app.module.ts`
- `apps/api/src/prisma/prisma.service.ts`
- `apps/api/src/finance/*`
- `apps/api/test/helpers/finance-test-store.mjs`
- `apps/api/test/unit/finance.service.test.mjs`
- `apps/api/test/integration/finance.api.test.mjs`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/types/src/finance.ts`
- `packages/types/src/index.ts`
- `apps/web/app/page.tsx`
- `apps/web/tsconfig.json`
