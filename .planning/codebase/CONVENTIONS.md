# Conventions

## Scope

This document focuses on Phase 3 finance code under `apps/api/src/finance`, the supporting Prisma schema, and the shared finance types used by the API.

## Current Conventions

### Module shape

- The finance implementation follows the existing NestJS domain-module pattern:
  - thin controllers per resource
  - shared domain service for business rules
  - one exception filter for domain-specific error mapping
- `FinanceModule` owns finance routes, service wiring, FX service wiring, and its own exception filter registration.

### Request validation and API surface

- DTOs use `class-validator` and rely on the global `ValidationPipe` configured in `apps/api/src/main.ts`.
- Query DTOs and body DTOs consistently require:
  - `legalEntityId` for entity-scoped operations
  - ISO date strings for period/report inputs
  - integer minor-unit amounts for journal and transfer amounts
- Finance-specific domain errors are defined centrally in `packages/types/src/finance.ts` and mapped to HTTP responses by `finance-exception.filter.ts`.

### Tenant scoping

- Tenant isolation is expected to come from CLS request context via `PrismaService.tenant`.
- Finance code uses `PrismaService.raw` only for framework-level operations that are not naturally expressed through the scoped client:
  - tenant discovery
  - legal-entity existence checks
  - FX rate persistence and scheduled refresh
- This is a coherent pattern, but it is only safe if request context and access rules are enforced upstream.

### Money and accounting representation

- Monetary values are stored in minor units using `BigInt` in Prisma models.
- Journal lines preserve both:
  - transaction-currency amounts via `transactionDebit` and `transactionCredit`
  - normalized base-currency amounts via `debit` and `credit`
- FX rates are stored as `Decimal` and locked onto each journal line at creation time.
- API responses serialize `BigInt`/`Decimal` values to strings through `finance.serialization.ts`.

### Accounting workflow rules

- Business rules are enforced in the service layer, not controllers:
  - journals must balance
  - posted entries are immutable
  - reversals create mirror entries
  - posting into closed periods is blocked
  - intercompany transfers create paired posted entries and a correlation record
- Report generation is derived from posted/reversed journal lines rather than stored aggregates.

## Observed Deviations and Weak Spots

### Transaction boundary consistency

- `FinanceService` uses a transaction wrapper for write flows, but some helper methods still resolve data through `prisma.raw` instead of the transaction client.
- This weakens transactional purity and increases the chance of harness drift, because tests must emulate both scoped and raw Prisma behavior.

### Runtime logging and debug behavior

- `finance.service.ts` contains `console.log` / `console.error` trace statements and wildcard-tenant auto-provisioning behavior.
- Those are practical for local debugging, but they are not aligned with a clean production convention:
  - no structured logger usage
  - side effects during tenant resolution
  - difficult-to-predict behavior for privileged requests

### Build-vs-test contract

- Unit and integration tests import compiled artifacts from `dist/src/...` rather than TypeScript source.
- That means the effective convention is:
  - build first
  - then run tests
- `apps/api/package.json` does not encode that prerequisite in `test:unit`, `test:integration`, or `test:finance`, so stale `dist` output can make test results misleading.

### Test harness parity burden

- The in-memory Prisma harness is extensive and useful, but it is a hand-maintained simulation of Prisma delegates, includes, filters, and relations.
- Any future finance schema or query change must be mirrored in the harness or tests can fail for harness reasons instead of product reasons.

## Phase 3 Confidence Read

- The finance code follows a mostly coherent set of conventions for domain rules, DTO validation, error mapping, and integer money handling.
- Confidence is reduced by three convention-level issues:
  - reliance on built `dist` artifacts for tests
  - mixed transactional/raw data access
  - debug-oriented behavior left in service code
- The implementation is credible for Phase 3, but the conventions are not yet at a production-hardened standard.
