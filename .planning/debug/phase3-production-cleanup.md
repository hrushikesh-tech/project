# Phase 3 Production Cleanup

Opened: 2026-04-14
Mode: find_and_fix

## Symptoms
- Admin and super-admin authentication paths widened requests to wildcard tenant scope.
- Tenant guard fabricated wildcard tenant context when the token was missing tenant metadata.
- Finance service resolved wildcard scope by selecting or creating a tenant at runtime.
- Finance tests loaded compiled `dist` artifacts without forcing a rebuild first.
- API port naming was inconsistent between `.env.example` and `main.ts`.
- `Account.balance` existed in schema/test fixtures but was not maintained by ledger workflows.

## Root Causes
- Auth and tenant middleware mixed authorization shortcuts into request scoping.
- Finance service included local-debug bootstrap behavior in production request paths.
- Test commands assumed compiled output was already current.
- Environment naming drifted between documentation and runtime code.
- Schema retained a derived balance field after reports moved to journal-line aggregation.

## Fix Plan
1. Require explicit tenant context for all finance requests.
2. Remove wildcard and auto-provision fallbacks from auth, guard, Prisma tenant extension, and finance service.
3. Rebuild before unit/integration finance tests.
4. Standardize `PORT_API` as the canonical API port variable, with `API_PORT` as fallback.
5. Remove stale `Account.balance` from the finance schema and test fixtures.
