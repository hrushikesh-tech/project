# Phase 13: API Gateway, GraphQL & Webhooks - Research

**Researched:** 2026-04-24
**Domain:** NestJS API platform standardization, OpenAPI 3.1 documentation, schema-first BI GraphQL, request envelopes, and trusted-operation enforcement
**Confidence:** MEDIUM-HIGH

## Summary

Phase 13 should be planned as an API-platform consolidation phase, not as a new business-domain module. The repo already has a broad NestJS API surface spread across auth, finance, AP/AR, HR, payroll, supply chain, forecasting, BI, project management, and notifications, but the platform concerns Phase 13 needs are mostly absent today: controllers hardcode `/api/v1/...`, responses are returned raw, domain exception filters hand-roll their own JSON shape, `apps/api/package.json` has no Swagger or GraphQL dependencies, and the frontend plus integration tests currently assume direct JSON bodies instead of a transport envelope. [VERIFIED: repo grep] [VERIFIED: apps/api/src/main.ts] [VERIFIED: apps/api/src/app.module.ts] [VERIFIED: apps/api/src/auth/auth.controller.ts] [VERIFIED: apps/web/src/lib/api/client.ts] [VERIFIED: apps/web/src/lib/auth/session.ts] [VERIFIED: apps/api/test/integration/*.mjs]

The cleanest implementation direction is:

1. Add shared API-platform infrastructure under `apps/api/src/common/api` for request IDs, success/error envelopes, pagination metadata helpers, and `/api-docs` protection.
2. Centralize URL handling with `app.setGlobalPrefix('api')` plus Nest URI versioning so external URLs stay `/api/v1/...` while controllers stop embedding the prefix directly. This matches Nest's documented URI-versioning behavior, where the version is inserted after the global prefix. [CITED: https://docs.nestjs.com/techniques/versioning]
3. Layer Swagger/OpenAPI over the current controller surface using `@nestjs/swagger` bootstrapped in `main.ts`, with tags and response metadata applied at controller/route level. [CITED: https://docs.nestjs.com/openapi/introduction]
4. Add a schema-first GraphQL endpoint for BI only, using `@nestjs/graphql` + `@nestjs/apollo` + `@apollo/server`, `typePaths`, generated definitions, request-scoped auth context, and DataLoader-backed resolver batching. Nest’s schema-first setup is a good fit because Phase 13 already locked the GraphQL contract semantically before code exists. [CITED: https://docs.nestjs.com/graphql/quick-start]
5. Enforce production GraphQL with a checked-in trusted-operation manifest keyed by SHA-256 hash instead of relying on Apollo APQ caching behavior. Apollo's APQ docs describe server-side caching of first-seen query documents, but this phase needs a hard safelist in production, and the repo has no GraphOS Router or external persisted-query infrastructure to lean on. [CITED: https://www.apollographql.com/docs/apollo-server/performance/apq/]

## Codebase Findings

### Existing API-platform seams

- `apps/api/src/main.ts` currently only mounts global validation and CORS; there is no global prefix, no versioning, no request-ID handling, and no Swagger bootstrapping.
- `apps/api/src/app.module.ts` already owns the global guards and audit interceptor, so it is the right composition point for new shared API-platform providers.
- `apps/api/src/common/interceptors/audit.interceptor.ts` already shows the repo is comfortable with cross-cutting response-path infrastructure.
- `apps/api/src/common/guards/jwt-auth.guard.ts`, `tenant.guard.ts`, and `roles.guard.ts` are written for HTTP execution context today, which is acceptable for REST but means GraphQL auth support will need a GraphQL-aware adapter or execution-context branch.

### Existing transport drift

- Controllers currently hardcode `@Controller('api/v1/...')`, which blocks centralized versioning.
- Domain exception filters (`finance`, `bi`, `notifications`) currently emit legacy `{ statusCode, error, message, path, timestamp }` bodies directly.
- The frontend API/auth helpers call `response.json()` and treat the body as the domain payload directly.
- Integration tests across auth, finance, BI, notifications, HR, payroll, and supply chain assert against raw body payloads today.

### Existing BI and webhook assets

- `apps/api/src/bi/bi.service.ts` and `apps/api/src/bi/metrics/bi-metrics.service.ts` already provide the BI read semantics GraphQL should wrap.
- `packages/types/src/bi.ts` already defines the metric keys and filter/result contracts, which is the right source of truth for GraphQL schema planning.
- `apps/api/src/notifications/notification-delivery.service.ts` and `apps/api/src/notifications/channels/webhook-channel.service.ts` already provide HMAC-signed outbound webhook behavior, so Phase 13 should document/standardize that contract instead of adding a second webhook subsystem.

## Recommended Technical Direction

### 1. Centralize `/api/v1` with global prefix + URI versioning

Move controllers from hardcoded `api/v1/...` strings to controller-local paths plus `version: '1'`, then bootstrap:

- `app.setGlobalPrefix('api')`
- `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`

This preserves current external URLs while making versioning a platform concern instead of a controller naming convention. Health can stay version-neutral if desired.

### 2. Implement one global envelope/error layer instead of rewriting every service return shape

Use:

- request-ID middleware or lightweight interceptor to generate/store `requestId`
- success envelope interceptor to wrap handler results as `{ data, meta }`
- global API exception filter to standardize Nest/HTTP/domain errors as `{ error, meta }`

The filter should normalize:

- normal `HttpException` responses
- raw `Error` instances
- legacy domain-filter payloads if those filters remain in place initially

This keeps the phase transport-focused and avoids rewriting service/business logic purely for shape changes.

### 3. Use Swagger decorators incrementally but systematically

`@nestjs/swagger` should be mounted centrally, but each controller will still need:

- `@ApiTags`
- `@ApiBearerAuth` where protected
- `@ApiOperation`
- response decorators that point at the shared envelope schema helpers

A shared decorator helper is worth adding so controllers can document enveloped responses without repeating large schema blocks.

### 4. Use schema-first GraphQL under the BI domain, not a repo-wide generic graph

Recommended GraphQL structure:

- `apps/api/src/bi/graphql/schema/*.graphql`
- `apps/api/src/bi/graphql/resolvers/*`
- `apps/api/src/bi/graphql/loaders/*`
- generated definitions file checked into `apps/api/src/bi/graphql/generated.ts` or similar

GraphQL should expose:

- metric-centric queries using the existing fixed BI metric keys and filters
- dashboard read helpers for dashboards, widgets, and metric snapshots

It should not expose writes or non-BI domain expansion in this phase.

### 5. Enforce production GraphQL with a checked-in trusted-operations manifest

Apollo APQ alone is not enough because it allows first-seen query text to populate the server cache. The safer fit for this repo is:

- checked-in JSON manifest: hash -> query document
- production requests must provide the hash
- unknown hash is rejected
- non-production can accept raw query text for local development

This meets the spirit of `API-05` without requiring GraphOS Router infrastructure the repo does not currently have.

### 6. DataLoader should batch relational BI reads, not re-implement metric computation

The main N+1 risk is repeated dashboard/widget/owner and related object fetches across GraphQL resolvers. Metric computation itself is already service-owned and often aggregate-heavy. So DataLoader should focus on:

- dashboard by id
- widgets by dashboard ids
- owner/user lookup
- any repeated report/dashboard relation loads

The BI metric service should remain the source of truth for aggregate semantics.

## Risks And Planning Traps

### 1. Controller migration is a compatibility migration, not just a platform add-on

Because the frontend and integration tests read raw bodies today, the envelope rollout must include client/test migration in the same phase or the repo will break immediately.

### 2. Domain exception filters can silently bypass the new global error contract

If the plan ignores module-scoped `APP_FILTER`s, some domains will keep returning legacy error bodies even after a global filter is added.

### 3. GraphQL auth will break if HTTP-only request assumptions are reused

The current guards read from HTTP request context directly. GraphQL resolvers need the same user/tenant semantics but through GraphQL execution context.

### 4. Trusted documents are easy to over-engineer

The repo does not need GraphOS safelisting infrastructure in this phase. A local manifest and a small Apollo plugin/validation layer are enough.

### 5. Swagger coverage can stall if every DTO is documented manually first

The plan should prioritize shared response decorators and route-level docs, then add DTO-specific metadata where it materially improves the API docs. Otherwise the documentation work can consume the phase.

## Validation Architecture

Phase 13 should validate across five layers:

1. **Platform bootstrap** - build succeeds with new Swagger/GraphQL dependencies, prefix/versioning, and env-gated docs.
2. **REST transport contract** - representative success and failure paths across auth/BI/notifications and at least one business module return the new envelope.
3. **GraphQL contract** - BI metric/dashboard queries work, unauthorized access fails, and production restrictions are enforced.
4. **Frontend compatibility** - the web API/auth helpers unwrap the new envelope without breaking login/profile/notifications/BI reads.
5. **OpenAPI/docs policy** - `/api-docs` renders in non-production and is disabled/protected correctly in production mode.

Recommended verification commands during execution:

- `pnpm --filter @amdox/api build`
- `pnpm --filter @amdox/api run test:integration:raw`
- `pnpm --filter @amdox/web typecheck`

Recommended Wave 0 requirements:

- GraphQL dependencies installed
- trusted-operations manifest scaffold exists
- one shared API envelope/error helper path exists before controller migration starts
- at least one integration test file updated early to anchor the new response contract

## Planning Implication

The cleanest plan split for Phase 13 is:

1. Platform foundation: dependencies, env contracts, global prefix/versioning, request IDs, success/error envelopes, Swagger bootstrap, docs protection.
2. Core REST migration + docs: auth, health, BI, notifications/webhooks.
3. Remaining REST migration + docs: finance, AP/AR, HR, payroll, supply chain, forecasting, project management.
4. BI GraphQL: schema-first module, resolvers, loaders, trusted manifest, production restrictions.
5. Compatibility and verification: frontend envelope unwrapping, full integration-suite migration, docs/GraphQL policy tests, validation sync.
