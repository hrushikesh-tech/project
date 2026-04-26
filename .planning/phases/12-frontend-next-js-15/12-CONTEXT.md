# Phase 12: Frontend (Next.js 15) - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete Next.js 15 frontend for the ERP using the App Router, covering authentication flow, shared app shell, role-aware landing pages, module UIs across Finance, AP/AR, HR, Payroll, Supply Chain, BI, Projects, and Notifications, plus the required tables, forms, charts, dashboard builder, Gantt chart, PWA behavior, and WCAG 2.1 AA accessibility.

This phase delivers the actual product UI and client-side interaction layer on top of the completed backend modules. It includes the frontend architecture, shared component system, auth/session UX, route protection, data fetching, offline-safe PWA support, and responsive/accessibility behavior needed for v1. It does not expand backend scope, introduce native mobile apps, create a custom analytics platform, or turn project scheduling into a full critical-path planning engine.

</domain>

<decisions>
## Implementation Decisions

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

### the agent's Discretion

- Exact route tree, file layout, and module grouping under `(auth)` and `(dashboard)` so long as the hybrid-shell decision and role-home-first behavior are preserved
- Exact component taxonomy for `packages/ui` and app-local UI wrappers
- Exact visual design system choices, density scales, motion, and typography within the enterprise-core-with-visual-highlights direction
- Exact boundaries of which low-risk draft actions qualify for offline queuing, so long as the queue remains selective and excludes high-risk transactional flows
- Exact client-state split between TanStack Query, Zustand, form state, and local component state
- Exact charting helper and D3 integration structure so long as the locked BI and Gantt decisions are preserved

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 12 goal, dependency chain, and success criteria
- `.planning/REQUIREMENTS.md` - `UI-01` through `UI-12`, plus related constraints from `AUTH-01` through `AUTH-10`, `BI-01` through `BI-05`, `PM-01` through `PM-05`, `NOTIF-01` through `NOTIF-06`, `SEC-03`, and `SEC-09`
- `.planning/PROJECT.md` - project-wide frontend stack, product boundaries, and non-negotiable constraints
- `.planning/STATE.md` - current project state and carry-forward notes from completed backend phases

### Prior phase context that constrains the frontend

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - Keycloak auth model, roles, MFA, tenant scoping, and auth endpoint expectations
- `.planning/phases/03-general-ledger-finance-core/03-CONTEXT.md` - finance-domain rules and reporting semantics that the journal-entry and statement UI must respect
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - invoice, OCR, match-review, and aging-report behavior that shapes AP/AR frontend workflows
- `.planning/phases/05-hr-core/05-CONTEXT.md` - employee, org chart, leave, and attendance semantics used by HR module UX
- `.planning/phases/06-payroll-engine/06-CONTEXT.md` - payroll-run, payslip, queue/progress, and storage expectations used by payroll UI
- `.planning/phases/07-supply-chain-inventory/07-CONTEXT.md` - PO lifecycle, goods receipt, warehouse, inventory, and FIFO semantics used by supply-chain UI
- `.planning/phases/08-ai-ml-demand-forecasting/08-CONTEXT.md` - forecast outputs, quality gating, and prediction semantics used by BI and forecast-facing screens
- `.planning/phases/09-business-intelligence-dashboard/09-CONTEXT.md` - fixed BI metric contracts, widget semantics, SSE invalidation behavior, and scheduled-report constraints
- `.planning/phases/10-project-management/10-CONTEXT.md` - project, milestone, resource-utilization, and bounded dependency rules used by the Gantt and project UI
- `.planning/phases/11-notification-event-engine/11-CONTEXT.md` - notification preferences, template behavior, and delivery semantics used by notification-center and preference UIs

### Existing backend contracts and shared types

- `apps/api/src/auth/auth.service.ts` - current login, refresh, logout, and user-info flow against Keycloak
- `apps/api/src/auth/strategies/jwt.strategy.ts` - JWT validation, role extraction, and tenant claim handling
- `packages/db/prisma/schema.prisma` - current domain models the frontend surfaces are built around
- `packages/types/src/index.ts` - shared type export surface available to the frontend
- `packages/types/src/finance.ts` - finance report and exception types that shape finance screens
- `packages/types/src/hr.ts` - HR-facing shared types
- `packages/types/src/payroll.ts` - payroll shared types
- `packages/types/src/supply-chain.ts` - supply-chain shared types
- `packages/types/src/bi.ts` - BI metric, widget, and refresh contracts used by the dashboard builder
- `packages/types/src/project-management.ts` - project-management and utilization types used by project screens
- `packages/types/src/notifications.ts` - notification and preference contracts used by notification UIs
- `packages/types/src/ml.ts` - forecasting-facing shared types that can inform dashboard and planning surfaces

### Existing frontend starting point and package seams

- `apps/web/package.json` - current frontend dependency baseline and the Next.js version drift that must be corrected
- `apps/web/app/layout.tsx` - current root layout entry point
- `apps/web/app/page.tsx` - current placeholder route showing the frontend is still a stub
- `packages/ui/package.json` - shared UI package exists but is currently an empty scaffold

### Codebase guidance

- `.planning/codebase/STRUCTURE.md` - monorepo shape and current frontend package state
- `.planning/codebase/CONVENTIONS.md` - established service, validation, and package conventions that new frontend code should align with where applicable

No separate external frontend ADRs or UI specs exist yet - the frontend requirements are fully captured by the references above plus the decisions in this context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/types/src/*` already provides a meaningful shared type surface for BI, finance, payroll, project-management, notifications, forecasting, and other modules; Phase 12 should reuse these instead of inventing disconnected client contracts.
- `apps/api/src/auth/auth.service.ts` and `apps/api/src/auth/strategies/jwt.strategy.ts` provide the current auth and JWT expectations that the frontend login/session flow must integrate with.
- `packages/ui` already exists as a workspace package, so Phase 12 can turn it into the shared design-system/component layer instead of building all UI primitives inside `apps/web`.

### Established Patterns

- Backend capabilities are already organized as domain slices, so the frontend should mirror module boundaries clearly rather than creating one giant undifferentiated client surface.
- The product has already locked TanStack Query and Zustand as the preferred frontend data/state direction in `PROJECT.md`.
- BI refresh behavior is invalidation-oriented rather than full server-pushed payloads, so the frontend should plan around re-fetch-on-event behavior.
- Existing backend work is tenant-scoped and role-aware; the frontend must keep tenant and role context central to navigation, protection, and UX decisions.

### Integration Points

- `apps/web` is still only a stub, so Phase 12 needs to establish the actual route groups, providers, middleware, and protected-shell architecture from scratch.
- `packages/ui` is effectively empty, so Phase 12 should decide what belongs in the shared UI package versus app-local module composition code.
- The frontend must integrate with backend modules for Finance, AP/AR, HR, Payroll, Supply Chain, BI, Projects, Forecasting, and Notifications without changing their phase-locked semantics.
- PWA and offline work must attach to the shared shell and client data layer in a way that does not compromise high-risk ERP actions.

</code_context>

<specifics>
## Specific Ideas

- Treat the current `next@16.2.3` entry as implementation drift, not a silent scope change.
- Make the ERP feel cohesive through one shared shell, but let each role start from a meaningful home page rather than a generic empty dashboard.
- Keep operational workflows dense and efficient, but use richer visual treatment on summaries, dashboards, empty states, and landing screens so the product does not feel flat.
- Let the dashboard builder feel flexible in layout while staying strict about data meaning.
- Keep the Gantt chart fast and practical for rescheduling, not a full planning-engine replacement.
- Make offline behavior honest and selective: visible queue status, safe drafts/preferences only, and no pretending that high-risk financial or inventory operations are safely offline.

</specifics>

<deferred>
## Deferred Ideas

- Adopting Next.js 16 instead of the required Next.js 15 target
- Turning the dashboard builder into a custom analytics or ad hoc reporting platform
- Expanding the Gantt chart into a full scheduling engine with critical-path or cascading auto-reschedule behavior
- Broad offline-first mutation support across high-risk ERP modules
- Native mobile apps beyond the PWA approach already locked for v1

</deferred>

---

*Phase: 12-frontend-next-js-15*
*Context gathered: 2026-04-21*
