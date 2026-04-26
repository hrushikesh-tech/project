# Phase 14: Security Hardening - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply comprehensive security controls across the existing ERP stack: hardened JWT/session behavior, universal request and form validation, browser security headers, route-aware rate limiting, tenant-safe resource access, secure file-upload handling, and secrets hygiene checks.

This phase hardens the already-built backend and frontend surfaces from Phases 12 and 13. It does not add new business capabilities, replace Keycloak with a different auth model, or expand into broader compliance, infrastructure, or CI/CD scope that belongs to later phases.

</domain>

<decisions>
## Implementation Decisions

### Session Control

- **D-01:** Phase 14 should use a strict enterprise session model.
- **D-02:** Refresh tokens must rotate on every successful refresh, and the previously used refresh token must be revoked immediately.
- **D-03:** Password changes must revoke all active sessions for that user, not only the current session.
- **D-04:** The platform must enforce the `SEC-09` max-5 concurrent-session rule by blocking a 6th session until the user signs out elsewhere rather than silently evicting older sessions.

### Super-Admin Tenant Access

- **D-05:** Cross-tenant super-admin access must require an explicit tenant switch on every request path that touches tenant data.
- **D-06:** Every cross-tenant super-admin action must be auditable with enough context to show which tenant was selected and who performed the action.
- **D-07:** Silent wildcard-style cross-tenant behavior must not remain in runtime request handling for Phase 14.

### Browser Security Headers

- **D-08:** CSP should roll out as a report-first policy before moving to full enforcement.
- **D-09:** HSTS and frame-embedding protections should be enabled immediately rather than waiting for the CSP enforcement cutover.
- **D-10:** The target policy remains a strong CSP that disallows unsafe inline execution; the phased rollout is for safer adoption, not a weaker end state.

### Rate Limits And Abuse Controls

- **D-11:** Phase 14 should use layered rate limiting rather than a single identity model.
- **D-12:** Anonymous and authentication-sensitive traffic should be limited primarily by IP before identity is established.
- **D-13:** Authenticated traffic should use per-user and per-tenant controls where identity is available, while still honoring the roadmap thresholds for global, auth, OCR, and payroll-sensitive routes.
- **D-14:** Rate-limit failures must return clear `429` responses with predictable behavior instead of opaque transport failures.

### Validation And Upload Safety

- **D-15:** The Phase 14 expectation is to finish universal validation coverage rather than introduce a second validation strategy: `class-validator` for all NestJS DTOs and Zod for all Next.js forms.
- **D-16:** Existing file-upload hardening from Phase 4 should be treated as the baseline pattern to reuse and generalize rather than as a one-off AP/AR implementation.

### the agent's Discretion

- Exact persistence model for refresh-token rotation and revoked-session tracking, so long as one-time refresh use, all-session revocation on password change, and the hard 5-session cap are preserved
- Exact audit fields and event naming for super-admin tenant switching, so long as cross-tenant activity is reconstructable
- Exact CSP directives, report pipeline, and rollout sequencing between report-only and enforcement, so long as the end-state policy remains strong and non-inline
- Exact limiter implementation split between Nest guards/interceptors/storage keys and any frontend handling, so long as the layered identity model and roadmap thresholds are preserved
- Exact inventory of remaining frontend forms and backend DTOs to close out universal validation coverage

</decisions>

<specifics>
## Specific Ideas

- Treat session abuse and token replay as first-class threats, not just a refresh-token plumbing exercise.
- Keep super-admin operations powerful but explicit: choosing a tenant should feel intentional and leave a durable audit trail.
- Roll CSP out carefully, but with a clear enforcement destination rather than indefinite report-only drift.
- Prefer rate limits that distinguish anonymous abuse from legitimate tenant traffic, especially for shared-office or VPN-heavy enterprise customers.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 14 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `SEC-01` through `SEC-09`, plus related auth, UI, and API constraints already locked in earlier phases
- `.planning/PROJECT.md` - project-wide security/compliance posture and non-negotiable constraints
- `.planning/STATE.md` - current execution state and carry-forward notes

### Prior phase context that constrains Phase 14

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - Keycloak model, RS256 JWT foundation, tenant claims, RBAC, MFA, and audit logging expectations
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - secure invoice-upload pattern and the earlier decision to treat upload/security constraints as non-negotiable
- `.planning/phases/12-frontend-next-js-15/12-CONTEXT.md` - frontend auth/session behavior, Zod form direction, and protected-shell assumptions
- `.planning/phases/13-api-gateway-graphql-webhooks/13-CONTEXT.md` - standardized API surface, GraphQL boundary, and platform-layer seams that security hardening must wrap rather than bypass

### Existing backend security seams

- `apps/api/src/main.ts` - global validation pipe, versioned API bootstrap, and the current lack of security-header wiring
- `apps/api/src/app.module.ts` - global guard/interceptor order and the platform seam for rate limiting or additional hardening
- `apps/api/src/auth/auth.controller.ts` - login, refresh, logout, and `me` endpoints that Phase 14 must harden
- `apps/api/src/auth/auth.service.ts` - current refresh/logout behavior and blacklist support
- `apps/api/src/auth/strategies/jwt.strategy.ts` - RS256 validation, JWKS lookup, tenant-claim extraction, and blacklist enforcement
- `apps/api/src/common/guards/tenant.guard.ts` - current tenant override behavior and the super-admin tenant-switch seam
- `apps/api/src/common/guards/roles.guard.ts` - RBAC enforcement seam that must remain aligned with security hardening
- `apps/api/src/common/interceptors/audit.interceptor.ts` - existing mutation audit trail seam that cross-tenant admin activity should extend
- `apps/api/src/prisma/prisma.service.ts` - tenant-scoped Prisma access and explicit non-wildcard expectations outside request context

### Existing upload and validation patterns

- `apps/api/src/ap-ar/ap-ar.controller.ts` - current upload endpoint/interceptor pattern
- `apps/api/src/ap-ar/ap-ar.service.ts` - current upload size checks, magic-byte/MIME validation, and allowed file-type policy
- `apps/web/src/components/forms/app-form.tsx` - shared React Hook Form + Zod pattern already in use
- `apps/web/src/lib/auth/session.ts` - frontend refresh-token handling and session-refresh behavior
- `apps/web/src/auth.ts` - NextAuth token/session callbacks that must stay aligned with the hardened backend contract

### Existing codebase guidance

- `.planning/codebase/CONVENTIONS.md` - DTO validation and service-layer conventions
- `.planning/codebase/STRUCTURE.md` - monorepo structure and API/frontend package seams
- `.planning/codebase/ARCHITECTURE.md` - backend request flow and platform-layer structure

No separate internal ADR for security hardening exists yet - the decisions above and the references here are the authoritative inputs for research and planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/api/src/auth/auth.service.ts` already provides token refresh and Redis-backed blacklist primitives, which can be extended into rotation and session-revocation behavior instead of replaced.
- `apps/api/src/auth/strategies/jwt.strategy.ts` already enforces `RS256` with JWKS lookup and revoked-token checks, so Phase 14 is building on a real JWT foundation.
- `apps/api/src/common/guards/tenant.guard.ts` already centralizes tenant selection, making it the right seam to tighten super-admin cross-tenant behavior.
- `apps/api/src/ap-ar/ap-ar.service.ts` already implements 10MB upload caps plus magic-byte/MIME validation for invoice files, which can become the reusable upload-hardening pattern.
- `apps/web/src/components/forms/app-form.tsx` already standardizes RHF + Zod for some forms, giving Phase 14 a concrete frontend validation baseline.

### Established Patterns

- Backend cross-cutting concerns are applied globally in Nest through `APP_GUARD`, `APP_FILTER`, and `APP_INTERCEPTOR` providers.
- Validation is intended to be centralized: Nest uses a global `ValidationPipe`, while the frontend stack direction already favors Zod-backed forms.
- Tenant safety depends on JWT -> guard -> CLS -> Prisma scoping; security hardening should reinforce that path rather than introducing alternate tenant-resolution paths.
- The API is now standardized behind `/api/v1` with shared envelope behavior, so rate-limit and auth hardening must integrate cleanly with that platform layer.

### Integration Points

- Session hardening will need coordinated changes across backend auth services/controllers and frontend session-refresh consumers.
- Super-admin tenant access hardening must connect auth claims, `TenantGuard`, audit logging, and any admin-facing tenant-switch UX or header contract.
- Browser-header work will likely touch the Nest bootstrap/platform layer for API headers and the Next.js app/runtime layer for web CSP behavior.
- Rate limiting must span the shared API platform layer while supporting route-specific limits for auth, OCR, and payroll-sensitive flows.
- Validation completion work spans both `apps/api` DTO coverage and `apps/web` form coverage, so planning should treat it as cross-stack hardening rather than backend-only work.

</code_context>

<deferred>
## Deferred Ideas

- Replacing Keycloak with a different identity provider
- Broad compliance or governance work that belongs to Phase 18
- CI security scanning and pipeline-enforcement changes that belong to Phase 17
- Infrastructure-level WAF and cloud-edge protections that belong to later deployment/cloud phases

</deferred>

---

*Phase: 14-security-hardening*
*Context gathered: 2026-04-24*
