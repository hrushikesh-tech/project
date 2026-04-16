---
status: testing
phase: 02-database-schema-authentication
source: [02-SUMMARY.md, ROADMAP.md]
started: 2026-04-12T03:50:00Z
updated: 2026-04-12T03:50:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Start the application infrastructure and API using Docker.
  1. `docker compose up -d` brings up all services (postgres, keycloak, redis).
  2. `pnpm run dev` in `apps/api` starts the server without errors.
  3. `GET http://localhost:3001/health` returns status "ok".
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: |
  Start the system from scratch. Docker services (Postgres, Keycloak, Redis) boot successfully.
  The NestJS API starts and the `/health` endpoint responds without authentication.
result: [pending]

### 2. Multi-Tenant Data Isolation
expected: |
  API requests automatically inject tenant context. 
  Attempting a database operation without a `tenantId` in the JWT (or for non-SuperAdmin) results in a failure or automatic filtering.
  Verified by checking that `createTenantClient` is used in the `PrismaService`.
result: [pending]

### 3. Soft Delete Verification
expected: |
  Deleting a record via the Prisma client (e.g., a User or Tenant) does not remove it from the DB.
  Instead, the `deletedAt` timestamp is set, and standard `findMany` queries exclude it by default.
result: [pending]

### 4. Keycloak Realm Import
expected: |
  Keycloak UI (http://localhost:8080) shows the `amdox-erp` realm.
  The realm contains the 7 defined roles and the `amdox-web`/`amdox-api` clients with proper configuration.
result: [pending]

### 5. Auth Flow (Login/Me/Logout)
expected: |
  1. `POST /api/v1/auth/login` with valid credentials returns a JWT.
  2. `GET /api/v1/auth/me` with the JWT returns the user's profile and roles.
  3. `POST /api/v1/auth/logout` blacklists the token in Redis.
result: [pending]

### 6. Mutation Audit Logging
expected: |
  Any POST/PUT/PATCH/DELETE request to an audited resource (e.g., creating a User) results in an `AuditLog` entry.
  The entry contains a `before` and `after` snapshot of the record.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
