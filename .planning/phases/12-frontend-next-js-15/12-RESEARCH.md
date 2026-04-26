# Phase 12: Frontend (Next.js 15) - Research

**Researched:** 2026-04-22
**Domain:** Next.js 15 ERP frontend architecture, auth/session UX, module contracts, BI/dashboard/Gantt UX, and selective offline PWA behavior
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Platform Baseline

- **D-01:** Phase 12 must align the frontend implementation to **Next.js 15**.
- **D-02:** The current `apps/web/package.json` drift to `next@16.2.3` should be treated as repo drift to correct during this phase rather than as the new product target.
- **D-03:** The frontend should keep using the already-chosen project stack direction from `PROJECT.md`: App Router plus `shadcn/ui`, TanStack Query, and Zustand unless planning finds a narrow compatibility reason to adjust within that overall direction.

### App Shell and Navigation

- **D-04:** The ERP should use a **hybrid shell**: one unified application frame with shared navigation and infrastructure, combined with strong role-aware landing pages.
- **D-05:** Users should land on a **role-based home first** after login rather than dropping directly into the last-used module by default.
- **D-06:** Module navigation should remain consistent across the product so Finance, HR, Supply Chain, BI, Projects, and Notifications feel like one ERP rather than separate mini-apps.

### Cross-Module UX Style

- **D-07:** The default frontend feel should be **enterprise core with visual highlights**.
- **D-08:** Data-heavy operational workflows should stay table- and form-first, while dashboards, summaries, empty states, and module home pages should carry the richer visual treatment.
- **D-09:** The frontend should optimize for serious ERP work first, not a card-only or dashboard-only experience.

### Dashboard Builder

- **D-10:** The BI frontend should provide **flexible drag-and-drop layout with fixed widget semantics**.
- **D-11:** Users may add, remove, drag, resize, and configure approved widgets, but they must stay inside the fixed built-in metric contracts established in Phase 9.
- **D-12:** Phase 12 should not turn the BI surface into a free-form analytics builder with arbitrary metric definitions, ad hoc query composition, or custom data semantics.

### Project Planning UX

- **D-13:** The project Gantt chart should support **interactive scheduling with bounded edits**.
- **D-14:** The Gantt surface must support dependency visibility and drag-to-reschedule behavior, but advanced auto-scheduling, critical-path analysis, and cascading planning logic remain out of scope for this phase.
- **D-15:** The frontend should favor fast rendering and operational clarity for the required 500-task view over deeper planning-engine behavior.

### Offline and PWA Behavior

- **D-16:** The PWA should use a **selective offline queue** rather than read-only offline behavior or broad offline-first mutation syncing across the ERP.
- **D-17:** Offline mutation queuing is limited to **low-risk draft and preference actions**.
- **D-18:** High-risk or high-conflict workflows such as finance posting, payroll actions, inventory-affecting operations, and dependency-sensitive project scheduling should remain online-only.
- **D-19:** The frontend should show clear sync/offline state instead of hiding queue status from users.

### Authentication and Protection

- **D-20:** Phase 12 must deliver a real Keycloak OIDC login flow with middleware protection and session refresh behavior that matches the existing backend auth contract rather than inventing a separate auth model.
- **D-21:** Authenticated users should enter the protected ERP shell only after tenant-aware identity and role information are available to drive route access and role-home selection.

### Claude's Discretion

- Exact route tree, file layout, and module grouping under `(auth)` and `(dashboard)` so long as the hybrid-shell decision and role-home-first behavior are preserved
- Exact component taxonomy for `packages/ui` and app-local UI wrappers
- Exact visual design system choices, density scales, motion, and typography within the enterprise-core-with-visual-highlights direction
- Exact boundaries of which low-risk draft actions qualify for offline queuing, so long as the queue remains selective and excludes high-risk transactional flows
- Exact client-state split between TanStack Query, Zustand, form state, and local component state
- Exact charting helper and D3 integration structure so long as the locked BI and Gantt decisions are preserved

### Deferred Ideas (OUT OF SCOPE)

- Adopting Next.js 16 instead of the required Next.js 15 target
- Turning the dashboard builder into a custom analytics or ad hoc reporting platform
- Expanding the Gantt chart into a full scheduling engine with critical-path or cascading auto-reschedule behavior
- Broad offline-first mutation support across high-risk ERP modules
- Native mobile apps beyond the PWA approach already locked for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Next.js 15 App Router with `(auth)` and `(dashboard)` route groups | Route-group and hybrid-shell recommendations in Architecture Patterns |
| UI-02 | Keycloak OIDC via next-auth v5 with auto-refresh and middleware protection | Auth.js/NextAuth v5 stack, backend auth seam mapping, middleware guidance |
| UI-03 | Standard data-table behavior across modules | TanStack Table + TanStack Query + export guidance |
| UI-04 | Standard form behavior with RHF + Zod | React Hook Form, Zod, resolver, unsaved-state pattern |
| UI-05 | Finance journal-entry form | Finance contract seam, dynamic-line and FX preview guidance |
| UI-06 | HR/payroll run dashboard with progress and artifact actions | Payroll/API seam analysis, transport-risk notes, validation gap notes |
| UI-07 | Supply Chain inventory heatmap | Supply-chain model seam and visualization recommendation |
| UI-08 | BI dashboard builder with `react-grid-layout` | BI widget/dashboard contracts, SSE refresh pattern, layout stack |
| UI-09 | D3.js Gantt chart with dependency arrows and drag reschedule | Bounded D3 usage, performance-oriented architecture, PM seam mapping |
| UI-10 | WCAG 2.1 AA accessibility | Accessibility standards and anti-pattern guidance |
| UI-11 | Responsive layouts at 375/768/1440 | Shell/layout recommendations and validation coverage |
| UI-12 | PWA service worker with IndexedDB offline queue and sync UX | Serwist + Dexie recommendation, selective offline boundary, security notes |
</phase_requirements>

## Summary

Phase 12 should be planned as a full frontend foundation plus domain-surface delivery phase, not as a thin skin over the API. The repo evidence shows `apps/web` is still a stub with `next@16.2.3`, a plain root layout, a placeholder home page, and `strict: false` TypeScript settings, while `packages/ui` exists only as an empty workspace shell. In contrast, the backend seams are already substantial and strongly domain-shaped across auth, finance, AP/AR, HR, payroll, supply chain, BI, projects, and notifications. [VERIFIED: repo grep] [VERIFIED: apps/web/package.json] [VERIFIED: apps/web/app/layout.tsx] [VERIFIED: apps/web/app/page.tsx] [VERIFIED: apps/web/tsconfig.json] [VERIFIED: packages/ui/package.json]

The planning baseline should therefore be: correct the frontend platform back to Next.js 15, build route groups and providers around a protected hybrid ERP shell, mirror the backend module boundaries in `apps/web`, and promote `packages/ui` into a real shared component/design-system package while keeping data-bound feature composition app-local. Shared contracts should come from `packages/types` and existing backend endpoints, not from a new frontend-only schema layer. [VERIFIED: repo grep] [VERIFIED: packages/types/src/index.ts] [VERIFIED: apps/api/src/auth/auth.controller.ts] [VERIFIED: apps/api/src/bi/bi.controller.ts] [CITED: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups]

The riskiest planning areas are auth/session integration, BI live refresh, the Gantt implementation, and offline behavior. The backend already exposes REST auth endpoints and BI SSE invalidation semantics, so Phase 12 should integrate with those constraints rather than invent alternate protocols. Offline support must remain selective and visible because the repo and locked decisions do not support broad conflict resolution for financial, inventory, payroll, or dependency-sensitive workflows. [VERIFIED: apps/api/src/auth/auth.controller.ts] [VERIFIED: apps/api/src/bi/bi.controller.ts] [VERIFIED: repo grep] [CITED: https://authjs.dev/] [CITED: https://nextjs.org/docs/app/guides/progressive-web-apps]

**Primary recommendation:** Plan Phase 12 around a Next.js 15 App Router shell with Auth.js/Keycloak integration, TanStack Query for server state, Zustand for shell/offline UI state, RHF+Zod for forms, shared contracts from `packages/types`, BI refresh via SSE-triggered query invalidation, D3 reserved for the bounded Gantt surface, and Serwist+Dexie only for a selective low-risk offline queue.

## Project Constraints (from PROJECT.md)

- Use the prescribed monorepo stack: Turborepo + pnpm workspaces. [VERIFIED: .planning/PROJECT.md]
- Frontend target remains `Next.js 15 (App Router) + shadcn/ui + TanStack Query + Zustand`. [VERIFIED: .planning/PROJECT.md]
- Security and compliance controls are non-negotiable: OWASP Top 10 2021, SOC 2 Type II, GDPR, ISO 27001. [VERIFIED: .planning/PROJECT.md]
- Performance targets remain active constraints: P95 API latency under 300ms and support for 2,000 concurrent users per tenant. [VERIFIED: .planning/PROJECT.md]
- Testing is mandatory, including unit, integration, E2E, and load testing; frontend planning should not assume test work can be deferred indefinitely. [VERIFIED: .planning/PROJECT.md]
- Zero hardcoded secrets. All auth and PWA/session implementation must keep secrets in env or secrets management only. [VERIFIED: .planning/PROJECT.md]
- The project direction explicitly rejects native mobile apps for v1; Phase 12 mobile effort must stay within the web/PWA boundary. [VERIFIED: .planning/PROJECT.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `15.5.15` | App Router frontend runtime | Locked project target; current repo drift is `16.2.3`, so Phase 12 must realign to the latest verified Next 15 patch line rather than inherit the drift. [VERIFIED: npm registry] |
| `next-auth` | `5.0.0-beta.31` | Auth.js integration for Next.js OIDC/session handling | Auth.js is the maintained path for Next.js auth flows and aligns with the locked Keycloak OIDC requirement. [VERIFIED: npm registry] [CITED: https://authjs.dev/] |
| `@tanstack/react-query` | `5.99.2` | Server-state caching, background refresh, mutation orchestration | Best fit for multi-module ERP data fetching, retries, stale-state management, and SSE-triggered refetch patterns. [VERIFIED: npm registry] |
| `zustand` | `5.0.12` | Lightweight client state for shell, filters, queue indicators, and session-adjacent UI state | Already aligned with project direction; avoids using a global store for server data. [VERIFIED: npm registry] |
| `react-hook-form` | `7.73.1` | Form state and submission handling | Standard fit for data-dense enterprise forms and works directly with Zod validation. [VERIFIED: npm registry] |
| `zod` | `4.3.6` | Frontend schema validation and form parsing | Explicitly required by `SEC-03` for all Next.js forms. [VERIFIED: npm registry] [VERIFIED: .planning/REQUIREMENTS.md] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hookform/resolvers` | `5.2.2` | Bridge RHF and Zod | Required on all forms that validate against Zod schemas. [VERIFIED: npm registry] |
| `@tanstack/react-table` | `8.21.3` | Headless data-table behavior | Use for shared table semantics required by `UI-03`. [VERIFIED: npm registry] |
| `react-grid-layout` | `2.2.3` | Drag/resize dashboard grid | Use for BI dashboard layout only; it matches the fixed-widget, flexible-layout decision. [VERIFIED: npm registry] |
| `recharts` | `4.4.2` | Standard BI chart primitives | Use for KPI, bar, line, pie, and other standard dashboard visuals; keep D3 scoped to Gantt/custom visuals. [VERIFIED: npm registry] |
| `dexie` | `5.2.0` | IndexedDB wrapper for queue persistence | Use for selective offline drafts/preferences and sync bookkeeping. [VERIFIED: npm registry] [CITED: https://dexie.org/docs/Tutorial/Getting-started] |
| `serwist` | `9.5.7` | Service worker/runtime caching integration | Prefer this over stale PWA wrappers when implementing the locked PWA requirement. [VERIFIED: npm registry] |
| `shadcn/ui` | [ASSUMED] | Accessible component baseline over Radix/Tailwind conventions | Locked by project direction, but exact package/versioning is generator-driven and was not registry-verified in this session. |
| `d3` | [ASSUMED] | Custom SVG/time-scale/dependency rendering for Gantt only | Use only where chart semantics exceed standard BI components. Exact package split/version was not verified in this session. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `serwist` | `next-pwa` | `next-pwa` is materially stale in registry metadata relative to the current PWA/tooling ecosystem; not a good default for a fresh 2026 phase. [VERIFIED: npm registry] |
| `recharts` | broader D3-only charting | D3-only increases implementation and maintenance cost for standard BI widgets with little benefit given Phase 9’s fixed metric semantics. [VERIFIED: packages/types/src/bi.ts] [ASSUMED] |
| `zustand` for all state | TanStack Query + local state split | Using Zustand as a server-state store would blur caching, invalidation, and optimistic update boundaries. [VERIFIED: .planning/PROJECT.md] [ASSUMED] |

**Installation:**

```bash
pnpm --filter @amdox/web add next@15.5.15 next-auth@5.0.0-beta.31 @tanstack/react-query@5.99.2 zustand@5.0.12 react-hook-form@7.73.1 zod@4.3.6 @hookform/resolvers@5.2.2 @tanstack/react-table@8.21.3 react-grid-layout@2.2.3 recharts@4.4.2 dexie@5.2.0 serwist@9.5.7
```

**Version verification:** Current versions and registry recency were verified in-session with `npm view`. Notable checks: `next@15.5.15` published 2026-04-08; `next-auth@5.0.0-beta.31` and `@auth/core@0.41.2` published 2026-04-14; `@tanstack/react-query@5.99.2` published 2026-04-19; `zustand@5.0.12` published 2026-03-16; `react-hook-form@7.73.1` published 2026-04-20; `zod@4.3.6` published 2026-01-22; `react-grid-layout@2.2.3` published 2026-03-24; `recharts@4.4.2` published 2026-03-31; `serwist@9.5.7` published 2026-03-14. [VERIFIED: npm registry]

## Architecture Patterns

### Recommended Project Structure

```text
apps/web/
├── app/
│   ├── (auth)/                 # login/callback/session recovery routes
│   ├── (dashboard)/            # protected ERP shell and module routes
│   ├── api/auth/               # Auth.js handlers if adopted
│   └── layout.tsx              # root providers and document shell
├── src/
│   ├── features/
│   │   ├── finance/
│   │   ├── apar/
│   │   ├── hr/
│   │   ├── payroll/
│   │   ├── supply-chain/
│   │   ├── bi/
│   │   ├── projects/
│   │   └── notifications/
│   ├── lib/
│   │   ├── api/                # typed fetchers/adapters over backend endpoints
│   │   ├── auth/               # session, claims, role-home, guards
│   │   ├── query/              # QueryClient, keys, invalidation helpers
│   │   ├── offline/            # Dexie schema, queue policy, sync status
│   │   └── accessibility/      # focus management, announcements, utilities
│   ├── providers/              # query, theme, auth/session, shell state
│   └── styles/                 # tokens and global styles
packages/ui/
├── src/
│   ├── primitives/             # buttons, inputs, dialog, popover, toast
│   ├── data-display/           # table shell, empty/error/loading states
│   ├── forms/                  # shared field shells and form chrome
│   └── layout/                 # nav shell, sidebar, app-header primitives
packages/types/
└── src/                        # existing domain contract seam to reuse
```

### Pattern 1: Route Groups + Protected Hybrid Shell

**What:** Use App Router route groups to separate public auth flows from the protected ERP shell while preserving one cohesive application frame after sign-in.

**When to use:** Immediately in Wave 0/1, because `apps/web` currently has only a root placeholder route and no route protection structure. [VERIFIED: apps/web/app/page.tsx]

**Example:**

```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
app/
  (auth)/
    login/page.tsx
  (dashboard)/
    finance/page.tsx
    hr/page.tsx
    layout.tsx
```

### Pattern 2: Domain-Aligned Feature Slices

**What:** Mirror backend domain slices in frontend feature folders and typed client adapters instead of building one generic “screens” layer.

**When to use:** For every module surface, because the backend already exposes strongly separated controllers, DTOs, Prisma models, and shared types. [VERIFIED: repo grep] [VERIFIED: packages/types/src/index.ts]

**Example:**

```ts
// Source: repo contracts
// apps/api/src/auth/auth.controller.ts
// apps/api/src/finance/finance-journal-entries.controller.ts
// packages/types/src/index.ts
```

### Pattern 3: Query for Server State, Zustand for UI State

**What:** Keep fetched entities, pagination, invalidation, and mutation lifecycles in TanStack Query; use Zustand only for cross-route client state such as sidebar collapse, role-home preferences, queue banners, and unsaved-work prompts.

**When to use:** Across all module UIs, especially tables, dashboards, and forms with retry/loading/empty/error requirements.

**Example:**

```ts
// Source: https://authjs.dev/ and project stack decisions
// Query caches /api/v1/* responses.
// Zustand stores shell preferences and offline queue indicators.
```

### Pattern 4: BI SSE Invalidates Query Cache

**What:** Treat the BI stream as an invalidation trigger, then refetch dashboard data through normal query paths.

**When to use:** On BI dashboard screens and scheduled-report status views, because the backend exposes `@Sse("dashboards/:id/stream")` and the locked decisions favor fixed metric contracts over custom streaming semantics. [VERIFIED: apps/api/src/bi/bi.controller.ts]

**Example:**

```ts
// Source: apps/api/src/bi/bi.controller.ts
// Open EventSource on /api/v1/bi/dashboards/:id/stream
// On message => queryClient.invalidateQueries({ queryKey: ['bi', 'dashboard', id] })
```

### Pattern 5: Selective Offline Queue with Policy Gate

**What:** Persist only explicitly low-risk drafts/preferences in IndexedDB and expose visible sync state in the shell.

**When to use:** For draft forms, notification preferences, and similarly bounded mutations. Do not apply it to journal posting, payroll execution, inventory movements, or dependency-sensitive project scheduling. [VERIFIED: 12-CONTEXT.md] [VERIFIED: .planning/REQUIREMENTS.md]

**Example:**

```ts
// Source: https://dexie.org/docs/Tutorial/Getting-started
// Source: https://nextjs.org/docs/app/guides/progressive-web-apps
// Queue schema stores: id, module, action, payload, createdAt, syncState
// Policy gate rejects high-risk mutation types before enqueue
```

### Anti-Patterns to Avoid

- **Frontend-only contract layer:** Do not recreate backend DTO semantics in `apps/web` when `packages/types` and existing endpoints already provide a contract seam. [VERIFIED: packages/types/src/index.ts]
- **Zustand as server cache:** Do not put paginated list data, BI metric payloads, or auth-refresh orchestration into Zustand when Query already solves stale data and retries. [ASSUMED]
- **Free-form BI semantics:** Do not let widget configuration mutate the meaning of BI metrics; Phase 9 fixed those contracts already. [VERIFIED: 12-CONTEXT.md]
- **Broad offline mutations:** Do not enqueue high-risk ERP operations under “last-write-wins” semantics; that would violate locked offline boundaries. [VERIFIED: 12-CONTEXT.md]
- **Single-package frontend:** Do not dump all reusable UI and app-specific compositions into one layer; `packages/ui` should host primitives/composites, while feature composition remains in `apps/web`. [VERIFIED: packages/ui/package.json] [ASSUMED]

## Repo Seams to Honor

### Frontend Starting Point

- `apps/web` currently contains only a plain root layout and placeholder home page, so Phase 12 must create the actual provider graph, middleware, route groups, and protected shell from scratch. [VERIFIED: apps/web/app/layout.tsx] [VERIFIED: apps/web/app/page.tsx]
- `apps/web/package.json` currently drifts to `next@16.2.3`; this is repo drift, not a new target. [VERIFIED: apps/web/package.json] [VERIFIED: 12-CONTEXT.md]
- `apps/web/tsconfig.json` is currently `strict: false`, which is materially weak for a shared-contract ERP frontend. Tightening types should be planned early. [VERIFIED: apps/web/tsconfig.json]

### Shared Package Seams

- `packages/ui` exists but has no actual dependency or component baseline yet; planning must allocate work to make it real rather than assuming it already provides a design system. [VERIFIED: packages/ui/package.json]
- `packages/types/src/index.ts` already re-exports domain contracts for enums, ML, AP/AR, finance, HR, payroll, supply chain, BI, projects, and notifications; use that surface as the first contract source. [VERIFIED: packages/types/src/index.ts]

### Backend Contract Seams

- Auth seam: `/api/v1/auth/login`, `/refresh`, `/logout`, `/me`, `/verify-mfa`. [VERIFIED: apps/api/src/auth/auth.controller.ts]
- BI seam: dashboard CRUD, widget CRUD, dashboard data, SSE stream, report schedules. [VERIFIED: apps/api/src/bi/bi.controller.ts]
- The wider API is organized by module controllers for finance, HR, payroll, supply chain, projects, notifications, and AP/AR; frontend module routing should mirror that boundary. [VERIFIED: repo grep]
- The Prisma schema already contains the multi-tenant business models the frontend must surface; planner should assume real dense business entities, not demo-grade mock shapes. [VERIFIED: packages/db/prisma/schema.prisma]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OIDC session flow | Custom PKCE/session/token-rotation framework | Auth.js / NextAuth v5 with Keycloak provider wiring | Session refresh, callbacks, cookies, middleware integration, and future auth maintenance are not worth custom code here. [CITED: https://authjs.dev/] [VERIFIED: npm registry] |
| Form state and validation | Bespoke form reducer + custom validator set | RHF + Zod + resolvers | Inline errors, submit disabling, schema parsing, and dirty-state tracking are already solved. [VERIFIED: npm registry] |
| Table engine | Custom sorting/filtering/pagination state machine | TanStack Table + Query-backed data hooks | `UI-03` requires consistent complex behavior across all modules; headless table primitives are the right base. [VERIFIED: npm registry] |
| Dashboard drag/resize | Custom grid physics and collision logic | `react-grid-layout` | Dashboard layout behavior is already a solved problem and this phase should focus on ERP semantics, not grid engines. [VERIFIED: npm registry] |
| Offline IndexedDB wrapper | Raw IndexedDB transaction layer | Dexie | IndexedDB ergonomics and schema/version handling are deceptively expensive to build by hand. [VERIFIED: npm registry] [CITED: https://dexie.org/docs/Tutorial/Getting-started] |
| Service worker integration | Manual ad hoc SW registration/caching strategy | Next PWA guidance + Serwist | Cache/version/update lifecycle is easy to get wrong; use current tooling. [CITED: https://nextjs.org/docs/app/guides/progressive-web-apps] [VERIFIED: npm registry] |
| Standard BI charts | D3-only visualization stack | Recharts for standard charts | Phase 9 fixed metric semantics; most value is in consistent rendering, not custom chart code. [VERIFIED: npm registry] |
| BI live transport | Custom websocket infrastructure | Existing SSE endpoint + query invalidation | The backend already exposes SSE semantics; adding a second live protocol creates mismatch. [VERIFIED: apps/api/src/bi/bi.controller.ts] |

**Key insight:** Phase 12 already has enough frontend-specific complexity in shell architecture, role-aware routing, dense operational forms/tables, BI builder behavior, Gantt interactions, accessibility, and offline policy. Hand-rolling commodity primitives would consume the schedule without improving product fit. [VERIFIED: repo state] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Leaving the App on Next.js 16 Drift

**What goes wrong:** Planning assumes the current `apps/web/package.json` is authoritative and builds on Next 16 behavior.

**Why it happens:** The repo already contains `next@16.2.3`, but both the roadmap and Phase 12 context explicitly lock the target to Next 15.

**How to avoid:** Make the downgrade/alignment a first-plan task and verify all foundational packages against that target.

**Warning signs:** Plans or PRs reference “Next 16” as the baseline. [VERIFIED: apps/web/package.json] [VERIFIED: 12-CONTEXT.md]

### Pitfall 2: Inventing a Separate Frontend Auth Model

**What goes wrong:** The frontend uses a session model that does not match the existing Keycloak-backed backend seam.

**Why it happens:** Teams sometimes treat SPA auth as independent from backend token/logout/role handling.

**How to avoid:** Map Auth.js session callbacks and middleware to the existing `/api/v1/auth/*` contract and tenant/role claims.

**Warning signs:** Route access depends on frontend-only roles or ignores backend tenant claims. [VERIFIED: apps/api/src/auth/auth.controller.ts] [VERIFIED: apps/api/src/auth/strategies/jwt.strategy.ts]

### Pitfall 3: Using Zustand as the Data Source of Truth

**What goes wrong:** Query invalidation, pagination, retries, and stale refresh logic become inconsistent or duplicated.

**Why it happens:** Zustand is easy to overuse once present in the app.

**How to avoid:** Reserve Zustand for shell/UI state and keep backend-backed entities in Query caches.

**Warning signs:** Stores begin holding paginated API payloads, BI metric datasets, or mutation orchestration. [VERIFIED: .planning/PROJECT.md] [ASSUMED]

### Pitfall 4: Overbuilding BI Live Updates

**What goes wrong:** The frontend adds websocket layers or client-side metric recomputation despite an existing invalidation stream and fixed metric semantics.

**Why it happens:** BI screens often invite “real-time” overengineering.

**How to avoid:** Use the SSE endpoint as an invalidation hint and keep metric fetching in the regular data layer.

**Warning signs:** A new websocket transport appears for dashboards. [VERIFIED: apps/api/src/bi/bi.controller.ts]

### Pitfall 5: Letting Offline Queue Touch High-Risk Actions

**What goes wrong:** Users can queue journal posting, payroll, inventory, or dependency-sensitive scheduling operations with no credible conflict model.

**Why it happens:** `UI-12` includes offline queueing, which can be misread as broad offline-first support.

**How to avoid:** Enforce a mutation allowlist and show queue state prominently.

**Warning signs:** Queue policy is module-agnostic or defaults to “any POST can enqueue.” [VERIFIED: 12-CONTEXT.md] [VERIFIED: .planning/REQUIREMENTS.md]

### Pitfall 6: Ignoring Frontend Test Infrastructure Gaps

**What goes wrong:** Plans assume component/E2E verification already exists.

**Why it happens:** The repo has substantial backend tests, but no frontend test framework is present yet.

**How to avoid:** Treat frontend test setup as Wave 0 work.

**Warning signs:** Plans reference `pnpm --filter @amdox/web test` or Playwright without first creating those commands/configs. [VERIFIED: apps/api/package.json] [VERIFIED: repo grep]

### Pitfall 7: Keeping `strict: false`

**What goes wrong:** Contract mismatches between backend/types/frontend slip through during a large UI build.

**Why it happens:** `apps/web` still has the scaffold tsconfig.

**How to avoid:** Tighten TypeScript settings early in the phase and fix drift while the codebase is still small.

**Warning signs:** New adapters start using `any` and defensive null-shaping everywhere. [VERIFIED: apps/web/tsconfig.json]

## Code Examples

Verified patterns from official sources and repo seams:

### Route Groups for Public vs Protected Surfaces

```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
app/
  (auth)/
    login/page.tsx
  (dashboard)/
    layout.tsx
    page.tsx
```

### BI SSE Invalidation Hookup

```ts
// Source: apps/api/src/bi/bi.controller.ts
const streamUrl = `/api/v1/bi/dashboards/${dashboardId}/stream`;
const events = new EventSource(streamUrl);

events.onmessage = () => {
  queryClient.invalidateQueries({ queryKey: ["bi", "dashboard", dashboardId] });
};
```

### Auth Contract Surface to Match

```ts
// Source: apps/api/src/auth/auth.controller.ts
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/verify-mfa
```

### Dexie-Style Queue Table Shape

```ts
// Source: https://dexie.org/docs/Tutorial/Getting-started
type OfflineQueueItem = {
  id: string;
  module: string;
  action: string;
  payload: unknown;
  syncState: "queued" | "syncing" | "failed";
  createdAt: string;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router-first Next apps | App Router with route groups, layouts, server/client component split | Matured across Next 13-15 | Phase 12 should start on App Router, not retrofit later. [CITED: https://nextjs.org/docs/app/guides/upgrading/version-15] |
| Hand-rolled auth/session layers in Next apps | Auth.js / NextAuth v5 integrations | Current Auth.js path in 2025-2026 docs | Reduces auth drift against Keycloak/OIDC requirements. [CITED: https://authjs.dev/] |
| `next-pwa` as default PWA answer | Official Next PWA guidance plus current SW tooling such as Serwist | Ecosystem drift evident by 2026 registry metadata | Use maintained tooling for a new build. [CITED: https://nextjs.org/docs/app/guides/progressive-web-apps] [VERIFIED: npm registry] |
| D3 for all charting | Standard chart library plus D3 only for custom surfaces | Common current frontend practice [ASSUMED] | Keeps BI implementation bounded while preserving flexibility for Gantt. |

**Deprecated/outdated:**

- Treating `apps/web`’s current dependency set as authoritative for frontend planning is outdated because it is scaffold drift, not a locked architectural decision. [VERIFIED: apps/web/package.json] [VERIFIED: 12-CONTEXT.md]
- Treating `packages/ui` as already-implemented shared UI infrastructure is outdated because it is only a package scaffold. [VERIFIED: packages/ui/package.json]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `shadcn/ui` remains the practical component-system direction without a compatibility blocker on Next 15 | Standard Stack | Low; planner may need a narrow adjustment if implementation realities differ |
| A2 | D3 should remain scoped to the Gantt/custom dependency visualization rather than the whole BI charting surface | Standard Stack / Architecture Patterns | Medium; charting task estimates change if more custom D3 work is required |
| A3 | Using Zustand only for shell/UI state and Query for server state is the right split for this codebase | Architecture Patterns | Medium; poor state-boundary choices can create rework later |
| A4 | Recharts is sufficient for most BI widgets implied by Phase 9’s fixed metric set | Standard Stack / Don't Hand-Roll | Medium; if a locked BI widget needs lower-level rendering, the planner must expand custom viz work |

## Open Questions

1. **Payroll progress transport mismatch**
   - What we know: `UI-06` mentions WebSocket progress, but the current backend evidence reviewed in this session did not show a websocket transport seam for payroll progress.
   - What's unclear: Whether Phase 12 should introduce a websocket/SSE transport or whether the requirement text is ahead of the current backend contract.
   - Recommendation: Planner should treat this as an explicit design checkpoint before locking the payroll-run UX implementation.

2. **Exact low-risk offline allowlist**
   - What we know: The user locked offline queueing to low-risk drafts and preferences only.
   - What's unclear: Which concrete actions per module qualify beyond notification preferences and draft-style forms.
   - Recommendation: Plan an explicit queue-policy artifact early so offline behavior does not creep.

3. **Auth.js integration shape**
   - What we know: The project requires Keycloak OIDC via `next-auth v5`, auto-refresh, and middleware protection.
   - What's unclear: Whether the frontend should rely primarily on direct Keycloak OIDC flows, backend `/auth/*` proxy flows, or a hybrid that uses both.
   - Recommendation: Planner should create an auth-contract spike early and verify token/session ownership boundaries before broad UI implementation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | Next.js app, tooling, tests | ✓ | `v24.14.1` | — |
| `pnpm` | workspace installs and filtered commands | ✓ | `9.0.0` | `npm` for isolated checks only |
| `npm` | registry verification and package inspection | ✓ | `11.12.1` | — |
| frontend unit/component test runner | Validation Architecture | ✗ | — | Add in Wave 0 |
| frontend E2E runner | `UI-02`, `UI-08`, `UI-09`, `UI-10`, `UI-12` verification | ✗ | — | Add in Wave 0 |

**Missing dependencies with no fallback:**

- None at the machine/runtime level for planning. The blockers are repo-level test/tooling gaps, not missing Node package managers. [VERIFIED: local shell]

**Missing dependencies with fallback:**

- Frontend test tooling is absent in the repo, but can be added during Wave 0. [VERIFIED: repo grep]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Backend only today: Node built-in test runner via `apps/api` scripts; no frontend framework detected |
| Config file | none for frontend — see Wave 0 |
| Quick run command | `pnpm --filter @amdox/api test:unit` |
| Full suite command | `pnpm --filter @amdox/api test:finance` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | route groups and protected shell boot correctly | integration / E2E | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-02 | Keycloak login, refresh, middleware, role-home routing | E2E | `pnpm exec playwright test tests/e2e/auth.spec.ts` | ❌ Wave 0 |
| UI-03 | dense data-table interactions behave consistently | component + E2E | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-04 | RHF+Zod forms validate, disable, toast, and warn on unsaved changes | component | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-05 | journal-entry form balances debits/credits and previews FX | component + E2E | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-06 | payroll run dashboard shows progress and artifact actions | integration / E2E | `pnpm exec playwright test tests/e2e/payroll.spec.ts` | ❌ Wave 0 |
| UI-07 | inventory heatmap renders stock state accessibly and responsively | component / visual | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-08 | dashboard builder drags/resizes widgets with live preview | E2E | `pnpm exec playwright test tests/e2e/bi-builder.spec.ts` | ❌ Wave 0 |
| UI-09 | Gantt renders 500 tasks under target and supports bounded edits | perf + E2E | `pnpm --filter @amdox/web test` | ❌ Wave 0 |
| UI-10 | WCAG behavior is enforced on critical flows | E2E + accessibility audit | `pnpm exec playwright test tests/e2e/accessibility.spec.ts` | ❌ Wave 0 |
| UI-11 | responsive layouts behave at 375/768/1440 | E2E | `pnpm exec playwright test tests/e2e/responsive.spec.ts` | ❌ Wave 0 |
| UI-12 | service worker and offline queue obey policy and show sync state | E2E / manual-assisted | `pnpm exec playwright test tests/e2e/offline.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @amdox/web test`
- **Per wave merge:** `pnpm --filter @amdox/web test && pnpm exec playwright test`
- **Phase gate:** frontend unit/component suite, Playwright journeys, and backend contract regressions green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Add a frontend unit/component framework for `apps/web` such as Vitest + Testing Library. [ASSUMED]
- [ ] Add frontend test scripts to `apps/web/package.json`. [VERIFIED: apps/web/package.json]
- [ ] Add Playwright config and at least the critical phase journeys for auth, BI builder, Gantt, responsive, accessibility, and offline queue behavior. [VERIFIED: .planning/REQUIREMENTS.md]
- [ ] Add frontend test fixtures/mocks for backend contract seams and role/tenant session state. [VERIFIED: apps/api/src/auth/auth.controller.ts] [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js / Keycloak OIDC integration with role/tenant-aware post-login flow |
| V3 Session Management | yes | Token refresh, logout coordination, middleware-protected routes, explicit queue/session status |
| V4 Access Control | yes | Role-home routing plus backend-enforced RBAC and tenant scoping |
| V5 Input Validation | yes | Zod on all Next.js forms, matching `SEC-03` |
| V6 Cryptography | yes | Platform/OIDC/JWT/HMAC libraries only; never hand-roll crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data exposure in client fetchers | Information Disclosure | Derive access from session claims and rely on tenant-filtered backend contracts; never trust route params alone |
| Unauthorized route access through stale session state | Elevation of Privilege | Middleware protection plus role/tenant checks before rendering protected module routes |
| XSS through rich ERP data surfaces and notifications | Tampering / Information Disclosure | Escape/sanitize outputs, avoid unsafe HTML injection, keep CSP-compatible rendering paths |
| CSRF/session misuse around auth/logout flows | Spoofing | Use Auth.js/session protection patterns and explicit logout coordination |
| Unsafe offline replay of high-risk mutations | Tampering / Repudiation | Queue allowlist, visible sync status, reject protected/high-risk actions from offline persistence |
| Insecure file upload UX in AP/AR screens | Tampering | Enforce frontend accept/filter hints only as UX, but rely on backend MIME/magic-byte validation from `SEC-04` |

## Sources

### Primary (HIGH confidence)

- Repository files under `apps/web`, `packages/ui`, `packages/types`, `apps/api/src`, and `packages/db/prisma/schema.prisma` - current codebase seams, contracts, and drift checks
- `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups` - App Router route-group structure
- `https://nextjs.org/docs/app/guides/upgrading/version-15` - Next.js 15 upgrade/current guidance
- `https://nextjs.org/docs/app/guides/progressive-web-apps` - official PWA/service-worker guidance
- `https://authjs.dev/` - current Auth.js/NextAuth official docs
- `https://dexie.org/docs/Tutorial/Getting-started` - official Dexie IndexedDB usage guidance
- npm registry metadata checked via `npm view` for `next`, `next-auth`, `@auth/core`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-table`, `react-grid-layout`, `recharts`, `dexie`, `serwist`, and `next-pwa`

### Secondary (MEDIUM confidence)

- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, and `12-CONTEXT.md` - project-level locked scope and constraints

### Tertiary (LOW confidence)

- None beyond explicitly marked assumptions

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM-HIGH - package versions were verified live and major official docs were checked, but a few frontend library choices remain constrained by project direction or assumptions rather than full implementation docs.
- Architecture: MEDIUM - recommendations are grounded in repo seams and locked decisions, but some exact route/auth/offline boundaries still need plan-time confirmation.
- Pitfalls: HIGH - most major risks come directly from current repo drift, missing frontend infrastructure, or explicit conflicts with locked decisions.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22
