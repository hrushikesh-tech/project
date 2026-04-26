---
phase: 13
slug: api-gateway-graphql-webhooks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 13 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node `--test` integration suites plus Nest HTTP/GraphQL assertions |
| **Config file** | `apps/api/package.json` |
| **Quick run command** | `pnpm --filter @amdox/api run build` |
| **Full suite command** | `pnpm --filter @amdox/api run test:integration:raw` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/api run build`
- **After every plan wave:** Run `pnpm --filter @amdox/api run test:integration:raw`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | API-01 / API-02 / API-03 / API-05 | T-13-01 | Global prefix, versioning, request IDs, and docs gate are platform-owned | build | `pnpm --filter @amdox/api run build` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | API-01 / API-02 / API-03 / API-05 | T-13-02 | Auth, BI, notifications, and webhook routes emit the standard transport contract | integration | `pnpm --filter @amdox/api run test:integration:raw` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 2 | API-01 / API-02 / API-03 | T-13-03 | Remaining business modules follow the same envelope/docs/versioning contract | integration | `pnpm --filter @amdox/api run test:integration:raw` | ✅ | ⬜ pending |
| 13-04-01 | 04 | 2 | API-04 / API-05 | T-13-04 | BI GraphQL is read-only, role-protected, batched, and safelisted in production | integration | `pnpm --filter @amdox/api run test:integration:raw` | ✅ | ⬜ pending |
| 13-05-01 | 05 | 3 | API-01 / API-02 / API-04 / API-05 | T-13-05 | Frontend clients and integration tests consume the final envelope and GraphQL policies correctly | build + integration | `pnpm --filter @amdox/api run test:integration:raw && pnpm --filter @amdox/web typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/test/integration/graphql.api.test.mjs` - GraphQL happy-path/auth/policy smoke coverage
- [ ] `apps/api/src/bi/graphql/persisted-operations.json` - trusted-operation manifest scaffold
- [ ] `apps/api/src/common/api/*` - shared API envelope/error/request-id infrastructure before route migration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/api-docs` renders with expected tags and auth metadata | API-01 / API-05 | Visual docs rendering and tag readability are easier to confirm manually than with grep alone | Start the API in non-production, open `/api-docs`, confirm auth, BI, notifications, finance, HR, payroll, supply chain, forecasting, and project-management groups are present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
