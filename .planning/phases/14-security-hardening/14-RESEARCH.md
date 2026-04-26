# Phase 14: Security Hardening - Research

**Researched:** 2026-04-24
**Domain:** Keycloak-backed session hardening, tenant-safe access enforcement, API/web security headers, route-aware throttling, validation closure, upload safety reuse, and secrets hygiene
**Confidence:** MEDIUM-HIGH

## Summary

Phase 14 should be planned as a cross-stack hardening phase that closes security gaps in the already-built auth, API-platform, and frontend layers rather than as a net-new security subsystem. The repo already has meaningful foundations in place: RS256 JWT validation with JWKS, Redis-backed token blacklist checks, a central `TenantGuard`, global Nest `ValidationPipe`, AP/AR file magic-byte checks, a shared Zod-backed `AppForm`, and some tenant-isolation tests. [VERIFIED: `apps/api/src/auth/strategies/jwt.strategy.ts`] [VERIFIED: `apps/api/src/auth/auth.service.ts`] [VERIFIED: `apps/api/src/common/guards/tenant.guard.ts`] [VERIFIED: `apps/api/src/main.ts`] [VERIFIED: `apps/api/src/ap-ar/ap-ar.service.ts`] [VERIFIED: `apps/web/src/components/forms/app-form.tsx`]

The blocking gaps are also clear:

1. There is no app-side session registry or refresh-token lifecycle tracking yet, so the phase cannot satisfy rotation-on-use plus max-5 concurrent sessions from the current auth code alone. The backend simply proxies Keycloak token exchange and blacklists access-token JTIs on logout. [VERIFIED: `apps/api/src/auth/auth.service.ts`]
2. Super-admin tenant switching is already explicit in `TenantGuard`, which is good, but the current shape does not yet capture cross-tenant admin intent in the audit layer as a first-class security event. [VERIFIED: `apps/api/src/common/guards/tenant.guard.ts`] [VERIFIED: `apps/api/src/common/interceptors/audit.interceptor.ts`]
3. DTO validation is broad but not universal: the auth controller still uses inline body object types, and many controllers still accept raw `@Param(...): string` IDs without explicit validation pipes or parameter DTOs. [VERIFIED: `apps/api/src/auth/auth.controller.ts`] [VERIFIED: repo grep on controller signatures]
4. Browser/API security headers are effectively absent today. The Nest bootstrap mounts CORS and docs setup, but not `helmet` or CSP logic; the Next.js app has auth middleware but no response-header policy file. [VERIFIED: `apps/api/src/main.ts`] [VERIFIED: `apps/web/src/middleware.ts`] [VERIFIED: no `next.config.*` file in `apps/web`]
5. There is no rate-limiter dependency or route-aware throttling policy in the API package yet. [VERIFIED: `apps/api/package.json`] [VERIFIED: repo grep for throttler/rate-limit]
6. Frontend Zod coverage exists, but only a small subset of forms currently use it; the login page still manages raw string state with no schema validation. [VERIFIED: `apps/web/src/components/finance/journal-entry-builder.tsx`] [VERIFIED: `apps/web/app/(dashboard)/dashboard/notifications/preferences/page.tsx`] [VERIFIED: `apps/web/app/(auth)/login/page.tsx`]
7. Secrets hygiene is not yet ready for a zero-findings scan. The repo still contains hardcoded development secrets or fallbacks in the Keycloak realm export, backend auth defaults, frontend auth fallback, and helper scripts. [VERIFIED: `infra/keycloak/amdox-realm.json`] [VERIFIED: `apps/api/src/auth/auth.service.ts`] [VERIFIED: `apps/web/src/auth.ts`] [VERIFIED: `scripts/phase12-auth-proxy.mjs`]

The cleanest implementation direction is to split the phase into four plans:

1. Auth/session and tenant-access foundation
2. API-side request hardening, headers, and throttling
3. Web/browser hardening and frontend validation completion
4. Cross-module verification, secrets scanning, and final validation evidence

## Codebase Findings

### Existing auth and session seams

- `apps/api/src/auth/auth.service.ts` exchanges password and refresh credentials directly with Keycloak and returns the raw token payload, but it does not persist refresh-token hashes, session IDs, device metadata, or active-session counts.
- `apps/api/src/auth/strategies/jwt.strategy.ts` already enforces `RS256`, issuer matching, JWKS lookup, and blacklist checks, which means Phase 14 can extend a real JWT validation path instead of replacing it.
- `apps/web/src/lib/auth/session.ts` already updates the stored refresh token when the backend returns a new one, so frontend compatibility with rotation is feasible, but the backend still needs a trustworthy source of rotated-session truth.
- `apps/web/src/auth.ts` currently hardcodes `process.env.AUTH_SECRET ?? "amdox-phase12-dev-secret"`, which is a direct Phase 14 secrets-hygiene violation.

### Tenant and IDOR seams

- `TenantGuard` already blocks super-admin requests that do not include `x-tenant-id` and rejects mismatched tenant overrides. That means the desired explicit-switch model is already partially implemented.
- `PrismaService.tenant` and the Prisma tenant extension already reject wildcard or missing tenant IDs on scoped operations, so the main remaining IDOR work is verification breadth and keeping all route entry points on the same guarded path.
- Cross-tenant integration coverage is incomplete today. The repo has tenant-denial assertions in HR and payroll tests, but not a phase-wide matrix covering every module endpoint promised by `SEC-08`. [VERIFIED: `apps/api/test/integration/hr.api.test.mjs`] [VERIFIED: `apps/api/test/integration/hr.leave-attendance.api.test.mjs`] [VERIFIED: `apps/api/test/integration/payroll.api.test.mjs`]

### Validation and upload seams

- The global `ValidationPipe` is enabled with `whitelist`, `forbidNonWhitelisted`, and `transform`, which is a strong platform baseline.
- Most existing DTO files already use `class-validator`, especially across finance, HR, payroll, BI, project management, notifications, and supply chain.
- The main backend validation drift is at the controller edge: auth endpoints still use inline request bodies, and many route params are untyped strings with no UUID or identifier validation pipe.
- `apps/api/src/ap-ar/ap-ar.service.ts` already enforces the 10MB upload cap and magic-byte/MIME allowlist for `PDF`, `PNG`, and `JPEG`. That logic is the right security baseline to extract into a shared upload guardrail rather than duplicating later.

### Header and rate-limiting seams

- `apps/api/package.json` does not yet include `helmet` or `@nestjs/throttler`.
- `apps/api/src/main.ts` does not yet register `helmet`, HSTS, frame protection, or CSP/report-only behavior.
- `apps/web` has middleware for auth redirects only; there is no `next.config.ts` `headers()` policy or CSP rollout mechanism yet.
- `apps/api/src/common/api/api-docs.ts` currently falls back to `amdox`/`amdox` docs credentials in production protection mode, which should be treated as a security hardening target rather than left as-is.

### Secrets-scan readiness

- The root package has no script for `trufflehog` or any equivalent secrets scan entry point.
- The repo contains multiple committed development secrets or fallback values:
  - `infra/keycloak/amdox-realm.json` -> `amdox-api-dev-secret`
  - `apps/api/src/auth/auth.service.ts` -> `amdox-api-dev-secret`
  - `apps/web/src/auth.ts` -> `amdox-phase12-dev-secret`
  - `scripts/phase12-auth-proxy.mjs` -> `amdox-api-dev-secret`
- Notification/webhook tests intentionally include secret literals as test fixtures; Phase 14 planning needs to distinguish fixture-safe values from committed runtime defaults so the scan strategy does not become noisy or misleading.

## Recommended Technical Direction

### 1. Add a backend session registry instead of relying on blacklist-only auth

Phase 14 needs a durable session ledger in the app database because blacklist-only logout is not enough to enforce:

- refresh-token rotation on every use
- max 5 concurrent sessions
- explicit revocation state
- auditability of active sessions and cross-device sign-ins

Recommended direction:

- add a `UserSession`-style Prisma model keyed by `tenantId`, `userId`, and Keycloak session identifier
- store only a hash of the refresh token, never the raw token
- track `issuedAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, `revocationReason`, and optional request metadata (`ipAddress`, `userAgent`)
- update login, refresh, and logout flows so the app validates the session row before proxying or honoring refresh operations

This keeps Keycloak as the identity source while giving the app the enforcement data it needs for `SEC-01`, `SEC-02`, and `SEC-09`.

### 2. Preserve explicit super-admin switching and extend it with audit intent

Because `TenantGuard` already requires `x-tenant-id` for `super_admin`, the phase should preserve that shape rather than redesigning cross-tenant access. The missing piece is durable audit intent:

- record selected tenant ID on every cross-tenant admin mutation
- record the acting user ID and role set
- reject any path that tries to smuggle wildcard tenant behavior back in

This is the safest route to `SEC-07` and `SEC-08` because it strengthens an existing seam instead of branching around it.

### 3. Close validation at the controller edge, not by replacing the platform baseline

`class-validator` plus the global `ValidationPipe` is already the established API pattern. Phase 14 should finish that pattern by:

- replacing inline auth bodies with DTO classes
- adding explicit parameter validation for identifier routes
- keeping transformation/whitelisting centralized in `main.ts`

On the frontend, the existing `AppForm` + RHF + Zod pattern should become the default for login and any remaining mutation forms rather than introducing a second form-validation abstraction.

### 4. Split header hardening across API bootstrap and Next.js runtime

Security headers need two execution surfaces:

- Nest/API side: `helmet`, HSTS, frameguard, no-sniff, referrer policy, report-only CSP where Swagger/API HTML is served
- Next.js/web side: route-level headers via `next.config.ts`, report-only CSP rollout, `frame-ancestors 'none'`, and environment-controlled reporting endpoint

Trying to solve CSP only in the API layer would miss the actual browser-rendered app responses.

### 5. Use route-aware throttling, not one blunt global limiter

The roadmap thresholds are heterogeneous:

- global `100 req/min`
- auth `10 req/min`
- OCR `5 req/min`
- payroll `1 req/hr`

That means the cleanest implementation is:

- one default throttling policy applied globally
- named overrides for auth, OCR, and payroll entry points
- identity keying that prefers IP for anonymous traffic and user/tenant for authenticated traffic
- standardized `429` responses that keep the Phase 13 error envelope

### 6. Treat secrets scanning as a repo contract, not only a CI concern

Phase 14 should not wait until Phase 17 CI/CD to make secrets scanning real. The repo needs:

- committed runtime defaults removed
- one repeatable local scan command or script
- a validation artifact that distinguishes required cleanups from acceptable test fixtures

That makes the later CI gate in Phase 17 an enforcement step instead of the first time the repo learns it has security debt.

## Risks And Planning Traps

### 1. Password-change revocation is trickier than logout

The app is not the password authority; Keycloak is. Any plan that assumes the Nest app can infer password change events without a Keycloak-aware check is likely too shallow. The execution plan needs an explicit source of truth for user-session invalidation, not a hand-wavy comment.

### 2. CSP can break Swagger or the Next.js runtime if rolled out in one shot

The user explicitly chose a report-first rollout. Plans should preserve that. Immediate enforcement would create a large break/fix loop with poor signal.

### 3. “All DTOs validated” can look complete while route params stay unguarded

The repo already has many DTOs. The remaining risk is believing the requirement is done while `@Param("id") id: string` remains accepted raw on high-value endpoints.

### 4. Secrets scanning can produce noise unless runtime defaults and fixture literals are separated

If the plan does not distinguish committed production defaults from test-only fixture values, the scan step may become noisy enough that people ignore it.

### 5. Cross-tenant testing must be broad enough to prove `SEC-08`

A couple of `403` tests are not enough. The plan needs either:

- one dedicated cross-tenant matrix suite, or
- systematic additions to every module integration file

Otherwise the phase will appear secure without proving the requirement.

## Validation Architecture

Phase 14 should validate across four layers:

1. **Auth/session contract** - login, refresh rotation, logout, and max-session enforcement behave predictably and reject revoked or stale session state.
2. **Request hardening** - DTO/param validation, upload filtering, security headers, and throttling produce the expected `4xx`/`429` outcomes.
3. **Tenant safety** - every module rejects cross-tenant access and super-admin cross-tenant flows remain explicit and auditable.
4. **Repo hygiene** - secrets scan passes with zero committed runtime secrets and the validation note truthfully records the final commands/results.

Recommended verification commands during execution:

- `pnpm --filter @amdox/api run build`
- `pnpm --filter @amdox/api run test:integration:raw`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web typecheck`
- `pnpm --filter @amdox/web build`
- local secrets-scan entry point added during Phase 14 execution

## Planning Implication

The cleanest plan split for Phase 14 is:

1. **Auth/session and tenant foundation**  
   Add session persistence, refresh rotation enforcement, auth DTO closure, Keycloak config alignment, and audited explicit tenant switching.
2. **API-side hardening**  
   Add `helmet`, throttling policy, backend route validation closure, and extracted upload-security helpers.
3. **Web/browser hardening**  
   Remove dev-secret fallbacks, add Next.js security headers with report-first CSP, and finish frontend Zod coverage starting with login/auth forms.
4. **Verification and hygiene closeout**  
   Add cross-tenant and throttling/security-header coverage, add a local secrets-scan entry point, and update `14-VALIDATION.md` with truthful evidence.

