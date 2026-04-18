# Phase 7: Supply Chain & Inventory - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the backend supply-chain and inventory slice for vendor management, purchase-order lifecycle, reorder automation, FIFO inventory costing, goods receipts, and inventory quantity management.

This phase delivers the domain rules, state transitions, background-job behavior, and inventory-costing logic needed for procurement and stock control. It does not add frontend UX, warehouse-transfer workflows, landed-cost allocation, or demand-forecast-driven purchasing decisions.

</domain>

<decisions>
## Implementation Decisions

### Goods Receipt Destination and Inventory Updates

- **D-01:** Every goods receipt must target exactly one destination warehouse at the receipt header level.
- **D-02:** If a shipment is physically split across warehouses, it must be recorded as multiple goods receipts rather than one receipt with mixed warehouse lines.
- **D-03:** Posting a goods receipt must update the referenced PO line `receivedQuantity`, the destination warehouse inventory quantity, and the destination warehouse FIFO cost layers in one atomic transaction.
- **D-04:** A goods receipt may be partial, but it must never receive more than the remaining open quantity for the referenced PO line.
- **D-05:** PO status must move to `PARTIALLY_RECEIVED` when some ordered quantity is still open and to `FULLY_RECEIVED` when all lines are fully received.

### FIFO Costing Policy

- **D-06:** New FIFO cost layers created by a goods receipt must use the agreed PO line unit price as the layer unit cost.
- **D-07:** Manual receipt-time cost overrides are out of scope for Phase 7; the system should not let operators change FIFO layer cost during receipt posting.
- **D-08:** FIFO consumption must deplete the oldest remaining cost layers first within the same product and warehouse.
- **D-09:** If a requested inventory consumption would exceed the total available quantity for that product and warehouse, the operation must fail with `InsufficientStockException` and must not partially consume cost layers.

### Reorder Automation Scope

- **D-10:** Reorder automation must evaluate available stock as tenant-wide product stock across all warehouses using on-hand minus reserved quantity, because `reorderPoint` is currently product-scoped rather than warehouse-scoped.
- **D-11:** Phase 7 must not guess vendor or legal-entity assignment for auto-generated POs. Reorder automation should only create a draft PO when the product has explicit replenishment configuration identifying the purchasing vendor and legal entity.
- **D-12:** If replenishment configuration is missing or ambiguous, the reorder job must skip that product and record a durable operator-visible reason instead of choosing a vendor or legal entity heuristically.
- **D-13:** The "no pending PO exists" check for reorder automation must treat `DRAFT`, `SUBMITTED`, `APPROVED`, `SENT_TO_VENDOR`, and `PARTIALLY_RECEIVED` as open/pending states. `FULLY_RECEIVED`, `CLOSED`, and `REJECTED` do not block a new reorder draft.

### PO Lifecycle Controls

- **D-14:** The Phase 7 PO workflow follows the defined lifecycle and explicitly preserves the rejection -> `DRAFT` loop for correction and resubmission.
- **D-15:** PO content is editable only while the PO is in `DRAFT` or after a rejection has moved it back to `DRAFT`.
- **D-16:** Transition from `APPROVED` to `SENT_TO_VENDOR` must be explicit rather than automatic on approval.
- **D-17:** Once a PO has moved beyond `DRAFT`, material line edits require the PO to be sent back through the rejection -> `DRAFT` path instead of allowing in-place mutation.

### Vendor Usage Rules

- **D-18:** Only vendors with `ACTIVE` status may be used for new manual POs or reorder-generated draft POs.
- **D-19:** `INACTIVE` and `BLACKLISTED` vendors must be blocked for new purchasing activity rather than allowed with warnings.
- **D-20:** Existing POs linked to a vendor that later becomes `INACTIVE` or `BLACKLISTED` may still complete downstream receiving for already-issued orders, but they must not be resubmitted or used as the basis for newly generated purchasing activity.

### the agent's Discretion

- Exact schema shape for replenishment configuration, as long as reorder automation has explicit vendor and legal-entity sourcing and never guesses
- Exact API endpoint names, DTOs, and exception-message wording for PO, vendor, receipt, and inventory operations
- Exact queue/job naming and scheduler wiring for the 6-hour reorder automation
- Exact service split between purchasing, inventory, and costing logic, as long as FIFO and receipt updates remain transactionally consistent

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and acceptance criteria

- `.planning/ROADMAP.md` - Phase 7 goal, dependencies, and success criteria
- `.planning/REQUIREMENTS.md` - `SC-01` through `SC-06`, plus cross-cutting constraints from `FIN-06`, `SEC-07`, and `SEC-08`
- `.planning/PROJECT.md` - project-wide architecture, stack, and non-negotiable quality constraints
- `.planning/STATE.md` - current execution state and prior-phase carry-forward notes

### Prior phase context that constrains Phase 7

- `.planning/phases/02-database-schema-authentication/02-CONTEXT.md` - tenant scoping, hybrid status-enum strategy, and request-context rules
- `.planning/phases/04-ap-ar-automation/04-CONTEXT.md` - PO and goods-receipt reuse in three-way matching, durable outbox/notification expectations, and background workflow patterns
- `.planning/phases/06-payroll-engine/06-CONTEXT.md` - current BullMQ job and operator-alert patterns for long-running backend workflows

### Existing data model and shared types

- `packages/db/prisma/schema.prisma` - existing `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `Product`, `InventoryItem`, `Warehouse`, `CostLayer`, and `GoodsReceipt` models
- `packages/db/src/index.ts` - exported Prisma model surface available to `apps/api`
- `packages/types/src/enums.ts` - shared `PurchaseOrderStatus` and `VendorStatus` enums

### Existing backend patterns and integration points

- `apps/api/src/prisma/prisma.service.ts` - request-scoped tenant client and explicit `forTenant()` usage for background jobs
- `apps/api/src/ap-ar/ap-ar.service.ts` - current PO and goods-receipt integration behavior used by AP three-way matching
- `apps/api/src/ap-ar/ap-ar.module.ts` - vertical module and queue wiring pattern
- `apps/api/src/hr/queue/hr-operations.queue.ts` - repeatable per-tenant BullMQ registration pattern
- `apps/api/src/hr/queue/hr-operations.processor.ts` - worker pattern using explicit tenant-aware Prisma access

### Codebase guidance

- `.planning/codebase/ARCHITECTURE.md` - NestJS request flow, Prisma boundaries, and module-architecture guidance
- `.planning/codebase/CONVENTIONS.md` - DTO validation, tenant scoping, and minor-unit money conventions
- `.planning/codebase/STRUCTURE.md` - module layout, package boundaries, and test placement

No separate ADRs or external project specs exist yet - requirements and constraints are captured in the references above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/db/prisma/schema.prisma`: the base supply-chain persistence models already exist, so Phase 7 should extend behavior on top of the established schema instead of inventing a separate storage path.
- `packages/types/src/enums.ts`: `PurchaseOrderStatus` already includes the roadmap lifecycle, including `REJECTED`, and `VendorStatus` already models `ACTIVE`, `INACTIVE`, and `BLACKLISTED`.
- `apps/api/src/prisma/prisma.service.ts`: background reorder processing can follow the established `forTenant()` pattern for explicit tenant-safe jobs outside request CLS.
- `apps/api/src/ap-ar/ap-ar.service.ts`: AP/AR already treats purchase orders and goods receipts as linked domain objects, so Phase 7 must preserve those relationships rather than re-model them incompatibly.

### Established Patterns

- Backend capabilities are implemented as vertical NestJS modules with thin controllers and service-layer business rules.
- Long-running and scheduled workflows use BullMQ with explicit tenant-aware payloads instead of relying on request CLS.
- Status workflows use app-layer TypeScript enums for evolving lifecycle values, consistent with the Phase 2 hybrid-enum decision.
- Monetary values for purchasing and costing should remain aligned with the existing minor-unit convention used elsewhere in the backend.

### Integration Points

- Phase 7 should land as a new backend module under `apps/api/src/supply-chain`.
- Goods-receipt behavior must remain compatible with AP three-way matching paths that already reference purchase orders and goods receipts.
- Reorder automation should reuse the existing repeatable-job and background-processor pattern rather than inventing a separate scheduler approach.
- Reorder skips, stock failures, and other operator-visible procurement issues can build on the existing durable event/notification persistence patterns already used by AP/AR and payroll.

</code_context>

<specifics>
## Specific Ideas

- Treat one goods receipt as one physical receiving event into one warehouse; split logistics should be modeled as separate receipts, not hidden line-level routing.
- Keep FIFO deterministic by pricing new cost layers from the PO agreement at receipt time.
- Reorder automation must never guess sourcing data such as vendor or legal entity.
- Use total available stock for Phase 7 reorder decisions because warehouse-level reorder policy is not modeled yet.

</specifics>

<deferred>
## Deferred Ideas

- Warehouse-specific reorder points and warehouse-local replenishment thresholds
- Inter-warehouse transfer and stock rebalancing workflows
- Landed-cost allocation, purchase-price variance, and receipt-time cost overrides
- Multi-vendor sourcing optimization or heuristic vendor selection during auto-reorder

</deferred>

---

_Phase: 07-supply-chain-inventory_
_Context gathered: 2026-04-18_
