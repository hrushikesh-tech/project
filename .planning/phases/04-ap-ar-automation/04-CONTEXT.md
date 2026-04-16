# Phase 4: AP/AR Automation - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend AP/AR automation slice for invoice ingestion and finance follow-through: upload invoice documents, persist them, run OCR asynchronously, perform payable-side 3-way matching against purchase orders and goods receipts, auto-post matched AP invoices into the existing ledger, flag mismatches for review, and expose unified AP/AR aging reports.

This phase does not add a frontend UI, a full notification engine, or a payments/collections subsystem. It delivers the backend workflow and report contracts needed for those later phases.

</domain>

<decisions>
## Implementation Decisions

### Invoice lifecycle
- **D-01:** Invoice uploads always create a draft invoice record, even when OCR is partial or fails. Failed or incomplete OCR results must remain reviewable instead of being rejected outright.
- **D-02:** OCR problems move the invoice into a reviewable state with an explicit reason recorded on the invoice. Re-upload is not the primary recovery path.

### Auto-posting policy
- **D-03:** Auto-posting applies only to AP invoices.
- **D-04:** AP invoices may auto-post only after the 3-way match passes all required conditions.
- **D-05:** AR invoices remain review-first in Phase 4. They should not auto-post purely from successful extraction.

### Posting strictness
- **D-06:** Vendor and customer posting control accounts must be explicitly configured before posting is allowed.
- **D-07:** If required control-account configuration is missing, the invoice must be routed to review rather than falling back to inferred or entity-default accounts.

### Mismatch handling
- **D-08:** Match failures must create durable `OutboxEvent` records immediately in Phase 4.
- **D-09:** Phase 4 should also create lightweight in-app finance notifications now, rather than waiting for Phase 11.
- **D-10:** The mismatch path is review-oriented: preserve the invoice, preserve mismatch reasons, and notify operators instead of failing the workflow silently.

### Aging report contract
- **D-11:** Phase 4 exposes one unified aging endpoint rather than separate AP and AR endpoints.
- **D-12:** The unified endpoint must accept `type=PAYABLE|RECEIVABLE`.
- **D-13:** Aging responses must include both summary bucket totals and invoice-level drill-down rows in the same contract.

### the agent's Discretion
- OCR provider implementation details, as long as the workflow supports the roadmap requirement of Textract primary with Tesseract fallback
- Exact manual review field-edit behavior before retry or approval
- Notification recipient selection details within the finance-side audience model
- Exact optional report filters beyond the required legal entity, type, and aging inputs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` - Phase 4 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` - `APAR-01` through `APAR-06`, plus relevant upload/security constraints in `SEC-04`, `SEC-06`, and `SEC-07`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable quality constraints
- `.planning/STATE.md` - current phase status and Phase 3 carry-forward constraints

### Existing finance and data foundations
- `packages/db/prisma/schema.prisma` - current AP/AR, supply chain, ledger, outbox, and notification models
- `packages/db/src/index.ts` - exported Prisma types and model surface available to `apps/api`
- `apps/api/src/prisma/prisma.service.ts` - tenant-scoped vs raw Prisma usage pattern
- `apps/api/src/finance/finance.service.ts` - existing journal creation, posting, legal-entity, and report rules that AP auto-posting must reuse
- `apps/api/src/finance/finance.module.ts` - current NestJS module structure for a vertical backend slice
- `apps/api/src/finance/finance-journal-entries.controller.ts` - existing ledger request surface and posting flow

### Existing test and architecture guidance
- `apps/api/test/helpers/finance-test-store.mjs` - established in-memory harness pattern for backend domain tests
- `apps/api/test/unit/finance.service.test.mjs` - existing unit-test style and expectations
- `apps/api/test/integration/finance.api.test.mjs` - existing integration-test shape using Nest testing + Supertest
- `.planning/codebase/STRUCTURE.md` - backend module structure, Prisma integration points, and test layout
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, money representation, and service-layer conventions
- `.planning/codebase/ARCHITECTURE.md` - request flow, guard/CLS usage, and finance-module architectural constraints
- `.planning/codebase/TESTING.md` - current verification approach and known test-environment limitations

No separate ADRs or external project specs exist yet - requirements and constraints are captured in the references above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/finance/finance.service.ts`: existing ledger orchestration that should remain the source of truth for journal posting behavior
- `apps/api/src/prisma/prisma.service.ts`: established split between `prisma.tenant` for request-scoped work and `prisma.raw` for framework/background paths
- `packages/db/prisma/schema.prisma`: already includes `Invoice`, `InvoiceLine`, `ThreeWayMatch`, `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine`, `Notification`, and `OutboxEvent`
- `apps/api/test/helpers/finance-test-store.mjs`: reusable pattern for fast in-memory service and API tests

### Established Patterns
- Backend features are organized as vertical NestJS modules with thin controllers and most business rules concentrated in a service layer
- DTO validation uses `class-validator` with the global `ValidationPipe`
- Tenant isolation is expected to flow through JWT -> `TenantGuard` -> CLS -> `PrismaService.tenant`
- Monetary values and ledger-facing amounts are represented in minor units and must stay compatible with the Phase 3 finance rules
- Tests currently run through Node's built-in runner and Supertest against built output in `apps/api/dist`

### Integration Points
- AP/AR automation should be implemented as a new module under `apps/api/src/ap-ar`
- Payable auto-posting must call into the existing finance posting path rather than duplicating ledger logic
- Background OCR workers will need the `prisma.raw` pattern plus explicit tenant-aware filtering because they run outside request CLS
- Mismatch notifications should bridge into the existing `OutboxEvent` and `Notification` tables so Phase 11 can build on them later
- Aging reports should align with the existing `/api/v1/...` controller pattern and serializer expectations in the API package

</code_context>

<specifics>
## Specific Ideas

- Keep failed OCR imports visible and recoverable - do not hide them behind hard failures or forced re-upload.
- Use one report contract for both AP and AR aging rather than splitting them into separate endpoints early.
- Treat explicit counterparty control-account configuration as a safety requirement for posting, not a convenience option.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 04-ap-ar-automation*
*Context gathered: 2026-04-14*
