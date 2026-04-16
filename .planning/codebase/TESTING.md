# Testing

## Scope

This document evaluates the automated tests and live verification paths around the Phase 3 finance implementation.

## Current Test Layers

### Unit tests

File: `apps/api/test/unit/finance.service.test.mjs`

Coverage provided:

- unbalanced journal rejection
- closed-period posting rejection
- posted-entry immutability and reversal behavior
- FX resolution order: Redis cache, then DB, then provider fallback

Characteristics:

- tests instantiate `FinanceService` directly
- FX behavior is partly stubbed and partly exercised through `FxRatesService`
- persistence is backed by an in-memory Prisma-like harness, not a database

### Integration tests

File: `apps/api/test/integration/finance.api.test.mjs`

Coverage provided:

- resource creation through HTTP endpoints
- posting journals through the Nest API
- report endpoint totals
- closed-period posting mapped to `409`
- FX lookup endpoint
- intercompany transfer endpoint

Characteristics:

- tests create a real Nest testing application with `supertest`
- validation pipes, controllers, module wiring, and exception filter are exercised
- `PrismaService`, `ClsService`, and `ConfigService` are overridden with test doubles
- no real Postgres, Redis, Keycloak, or OpenExchangeRates connection is used

### Aggregate script

File: `apps/api/package.json`

- `test:finance` runs `test:unit` and `test:integration`
- this is the practical Phase 3 verification entrypoint
- it does not run a build first, even though the tests import `dist/src/...`

## Harness Realism

### What is realistic enough

- The harness models the essential finance relations:
  - legal entities
  - accounts
  - fiscal periods
  - journal entries
  - journal lines
  - intercompany transfers
  - FX rates
- It supports enough Prisma-like behavior to exercise the finance service logic and the HTTP layer in a deterministic way.
- It is good at validating accounting invariants and report arithmetic.

### What is not realistic

- It is not Prisma itself. Query semantics, transaction behavior, relation loading, and uniqueness enforcement are only approximated.
- It does not verify real database concerns:
  - migrations
  - indexes
  - unique constraints under race
  - cascade behavior
  - decimal and bigint round-tripping through the database driver
- Redis behavior is simulated or bypassed:
  - the 24h TTL is implemented in source code, but not asserted against a live Redis instance
  - connection lifecycle issues are only partially exposed
- External FX fetching is only mocked in automated tests:
  - no real OpenExchangeRates contract test
  - no network failure/backoff behavior verified end to end
- Request context is synthetic:
  - no auth guard path
  - no real JWT parsing
  - no end-to-end tenant propagation from authentication to finance request

## Confidence Assessment

### High-confidence areas

- core accounting invariants in service logic
- basic report calculations from seeded journal data
- controller and DTO wiring for the implemented finance endpoints
- exception-to-HTTP mapping for the finance-specific error cases under test

### Medium-confidence areas

- intercompany transfer flow
- FX lookup persistence and cache-path branching
- serialization of finance values to API-safe strings

These are covered, but only inside the harnessed environment.

### Low-confidence areas

- real Postgres behavior
- real Redis TTL and connection behavior
- real OpenExchangeRates integration
- real authentication and tenant guard interaction
- concurrency and transaction isolation issues
- regression resistance when Prisma queries change but the harness is not updated

## Live Verification Read

The repository contains ad hoc live/UAT scripts under `apps/api/scratch`, including a Phase 3 finance script. These improve local operator confidence, but they are not part of the automated test contract.

Known properties of the live verification path:

- useful for checking local stack wiring
- depends on local infrastructure and credentials
- not reproducible in CI as currently written
- not encoded as pass/fail gates for the project

## Known Gaps That Matter for Phase 3 Sign-Off

- Tests depend on `dist` output and can report against stale code if build artifacts are outdated.
- No automated test runs against a real database and Redis together.
- No automated verification covers the full auth-to-finance request path.
- No automated check proves a live OpenExchangeRates fetch with `OPENEXCHANGE_APP_ID`.
- The in-memory harness is now part of the maintenance surface for finance work.

## Bottom Line

- The current automated suite supports reasonable engineering confidence that the Phase 3 finance rules and REST wiring work as implemented.
- It does not support production-grade confidence for infrastructure, external integrations, or authentication boundaries.
- The highest-value next step is one real-stack API smoke suite against Postgres, Redis, and auth, with a build step enforced before finance tests.
