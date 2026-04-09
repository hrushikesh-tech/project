# Pitfalls Research: Cloud ERP Platform

## Critical Pitfalls

### 1. Cross-Tenant Data Leakage
**Severity**: 🔴 Critical
**Warning signs**: Missing `tenantId` filter in any query; raw SQL without parameter binding
**Prevention**:
- Prisma middleware that ALWAYS injects `tenantId` — impossible to bypass
- PostgreSQL RLS as database-level backup
- CI test that attempts cross-tenant access for every endpoint → must return 403
- Never trust `tenantId` from request body; always extract from JWT
**Phase**: Phase 1 (Database + Auth)

### 2. Floating Point Monetary Calculations
**Severity**: 🔴 Critical  
**Warning signs**: Using `float` or `number` for monetary values; rounding errors in reports
**Prevention**:
- Store ALL monetary values as integers (cents/paise) — `Decimal` type in Prisma
- Divide by 100 only at display layer
- Never use `Math.round()` on intermediate calculations
- Use `Prisma.Decimal` for precise arithmetic
**Phase**: Phase 2 (Finance)

### 3. Unbalanced Journal Entries
**Severity**: 🔴 Critical
**Warning signs**: GL reports don't balance; trial balance has discrepancies
**Prevention**:
- Validate `SUM(debits) === SUM(credits)` in service layer BEFORE database write
- Database CHECK constraint as backup
- Immutable posted entries (reverse + re-post, never edit)
**Phase**: Phase 2 (Finance)

### 4. Payroll Calculation Errors
**Severity**: 🔴 Critical
**Warning signs**: Wrong net pay; tax miscalculations; employee complaints
**Prevention**:
- Extensive unit tests with known-good payroll scenarios
- Tax slab calculations verified against government tables
- Payroll run produces preview before committing
- Compensation saga rolls back partial runs on failure
**Phase**: Phase 3 (Payroll)

### 5. Race Conditions in Inventory
**Severity**: 🟡 High
**Warning signs**: Negative stock; overselling; double-booking of reserved inventory
**Prevention**:
- Use `SELECT ... FOR UPDATE` (pessimistic locking) on inventory rows during updates
- `reservedQuantity` tracked separately from `quantity`
- Reorder check uses `quantity - reservedQuantity` (not just `quantity`)
- Database-level CHECK constraint: `quantity >= 0`
**Phase**: Phase 4 (Supply Chain)

### 6. N+1 Queries in Nested Data
**Severity**: 🟡 High
**Warning signs**: Slow API responses > 1s for list views; excessive database queries
**Prevention**:
- Always use Prisma `include` for known relations instead of lazy loading
- GraphQL DataLoader for BI queries
- Monitor query count per request in development (log warning if > 10)
- Pagination on all list endpoints (never unbounded queries)
**Phase**: All phases

### 7. BullMQ Job Failures Without Recovery
**Severity**: 🟡 High
**Warning signs**: Lost jobs; silent failures; incomplete payroll runs
**Prevention**:
- Configure `attempts: 3` with exponential backoff on all jobs
- Implement compensation (rollback) for saga-pattern jobs (payroll, GL posting)
- Dead letter queue for jobs that exhaust retries
- Alert notification on job failure
**Phase**: Phase 8 (Notifications), Phase 3 (Payroll)

### 8. Keycloak Misconfiguration
**Severity**: 🟡 High
**Warning signs**: Users can access wrong tenant; MFA bypass; session not expiring
**Prevention**:
- Export realm config as JSON (version-controlled, reproducible)
- Test MFA enforcement for admin roles in E2E tests
- Verify session timeout configuration matches spec
- Custom claim mapper for `tenant_id` — test that it's present in every JWT
**Phase**: Phase 1 (Auth)

### 9. Missing Audit Trail
**Severity**: 🟡 High
**Warning signs**: Compliance auditors can't trace changes; "who changed what" unanswerable
**Prevention**:
- NestJS AuditInterceptor on ALL mutations — before/after JSON snapshots
- TimescaleDB hypertable for efficient time-range queries on audit data
- Immutable audit records (no UPDATE/DELETE on AuditLog)
- Include IP address, user agent, request ID in every audit record
**Phase**: Phase 1 (Auth), enforced across all phases

### 10. Frontend State Desync
**Severity**: 🟢 Medium
**Warning signs**: Stale data after mutations; optimistic updates that don't roll back
**Prevention**:
- TanStack Query `invalidateQueries` after every mutation
- Server-Sent Events for real-time dashboard updates
- Optimistic updates only where safe (e.g., leave request submission, not financial data)
- `staleTime` configuration per query type (financial: 0, dashboards: 30s)
**Phase**: Phase 9 (Frontend)

### 11. Docker Image Size Bloat
**Severity**: 🟢 Medium
**Warning signs**: >500MB images; slow CI builds; slow container startup
**Prevention**:
- Multi-stage builds (deps → build → distroless runtime)
- `.dockerignore` excludes `node_modules`, `.git`, `test/`
- Pin base images to exact digest
- Use Alpine variants for build stages
**Phase**: Phase 13 (Docker)

### 12. Insufficient Test Isolation
**Severity**: 🟢 Medium
**Warning signs**: Tests pass individually but fail in parallel; shared test data corruption
**Prevention**:
- Each test suite creates its own tenant (via `createTestTenant()`)
- Test cleanup runs in `afterAll` to delete test data
- Database transactions for integration tests (rollback after each test)
- Separate test database from development database
**Phase**: Phase 12 (Testing)

---
*Researched: 2026-04-09*
