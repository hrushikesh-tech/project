# Phase 7: Supply Chain & Inventory - Research

**Date:** 2026-04-18
**Phase:** 07-supply-chain-inventory
**Status:** Complete

## What This Phase Needs To Solve

Phase 7 has to turn the existing purchase-order and inventory schema shell into a real backend supply-chain slice that:

- manages vendors, products, warehouses, and purchasing-ready replenishment configuration
- enforces the PO lifecycle with the rejection -> `DRAFT` correction loop
- posts goods receipts into one destination warehouse and updates received quantities
- creates FIFO cost layers on receipt and consumes them oldest-first on stock issue
- throws `InsufficientStockException` before any partial stock depletion
- runs reorder automation every 6 hours without guessing vendor or legal-entity sourcing

The codebase already contains the base data models for vendor, PO, goods receipt, warehouse, inventory item, and cost layer. What is missing is the module-level runtime, the schema pieces needed by the locked Phase 7 decisions, and the test surface to prove FIFO, receiving, and reorder behavior.

## Codebase Findings

### Existing supply-chain-adjacent assets

- `packages/db/prisma/schema.prisma` already defines `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `Product`, `InventoryItem`, `Warehouse`, `CostLayer`, `GoodsReceipt`, and `GoodsReceiptLine`.
- `packages/types/src/enums.ts` already defines `PurchaseOrderStatus` with the roadmap lifecycle, including `REJECTED`, and `VendorStatus` with `ACTIVE`, `INACTIVE`, and `BLACKLISTED`.
- `apps/api/src/prisma/prisma.service.ts` already exposes `forTenant(tenantId)` for background jobs, which is the correct pattern for reorder automation.
- `apps/api/src/hr/queue/hr-operations.queue.ts` and `apps/api/src/hr/queue/hr-operations.processor.ts` show the current repeatable-job and explicit-tenant worker pattern.
- `apps/api/src/ap-ar/ap-ar.service.ts` and `apps/api/test/helpers/apar-test-store.mjs` already use purchase orders and goods receipts for AP three-way matching, so Phase 7 must preserve those relationships rather than remodel them incompatibly.
- `apps/api/package.json` already follows the repo's build-first test contract: `test:unit` and `test:integration` both build before executing dist-based tests.

### Important gaps

- No `apps/api/src/supply-chain` module exists yet.
- `GoodsReceipt` has no `warehouseId`, even though inventory and FIFO cost layers are warehouse-scoped.
- No replenishment or sourcing configuration exists to tell reorder automation which vendor, legal entity, or quantity to use when a product crosses its threshold.
- `Product.reorderPoint` exists, but there is no reorder quantity, target stock level, or vendor mapping; the cron trigger exists without enough data to create a correct PO.
- No inventory movement or stock-issue ledger exists, so FIFO depletion and stock-consumption auditing have no durable home today.
- No shared supply-chain exception contracts exist yet for invalid PO transitions, blocked vendors, missing replenishment config, or insufficient stock.
- `apps/api/src/common/schedule/schedule.ts` only exposes `EVERY_DAY_AT_1AM`; there is no existing `EVERY_6_HOURS` helper for SC-03.
- No dedicated supply-chain unit or integration tests exist yet.

## Recommended Technical Direction

### 1. Add a dedicated supply-chain vertical slice

Create `apps/api/src/supply-chain` following the same vertical-module pattern used by HR, AP/AR, and payroll.

Recommended sub-areas:

- `supply-chain.module.ts`
- `supply-chain.controller.ts`
- `supply-chain.service.ts`
- `dto/` for vendor, PO, goods receipt, inventory, and replenishment requests
- `receiving/` for goods-receipt posting logic
- `inventory/` for stock queries and FIFO consumption
- `reorder/` for replenishment and open-PO detection
- `queue/` for the 6-hour reorder job
- `supply-chain.serialization.ts` if response normalization is needed

Why this fits the repo:

- current backend features are vertical modules with thin controllers and service-heavy domain logic
- queue workers live beside their owning module, not in a shared jobs package

### 2. Extend the schema around warehouse-targeted receipts and explicit replenishment sourcing

The locked context already requires:

- one goods receipt -> one warehouse
- no heuristic vendor/legal-entity selection for reorder
- tenant-wide reorder evaluation against product-scoped thresholds

The current schema cannot satisfy those decisions cleanly. Planning should expect Prisma changes in at least these areas:

- add `warehouseId` to `GoodsReceipt`
- add PO lifecycle timestamps and/or metadata needed for `SUBMITTED`, `APPROVED`, `SENT_TO_VENDOR`, `REJECTED`, and `CLOSED` transitions
- add a replenishment/sourcing model such as `ProductReplenishmentSetting` or `ProductSupplierConfig` with:
  - `productId`
  - `legalEntityId`
  - `vendorId`
  - `reorderQuantity` or equivalent explicit draft-PO quantity
  - optional enablement/status metadata
- add an inventory movement log such as `InventoryMovement` so receipts and stock issues are auditable and FIFO depletion has durable references

Why the replenishment model matters:

- `reorderPoint` is only a trigger threshold
- without explicit sourcing + quantity config, reorder automation cannot create a correct draft PO without guessing
- the locked context explicitly forbids guessing

### 3. Treat FIFO as a warehouse-scoped inventory service, not just a schema side effect

`CostLayer` and `InventoryItem` are already warehouse-scoped. The runtime should preserve that by implementing FIFO in an explicit service layer with two main paths:

1. goods receipt path:
   - validate remaining PO quantity
   - update `PurchaseOrderLine.receivedQuantity`
   - upsert `InventoryItem`
   - create a new `CostLayer` using the PO line unit price
   - create an `InventoryMovement` receipt record

2. stock issue / consumption path:
   - validate available quantity before mutating anything
   - consume oldest cost layers first for the product + warehouse pair
   - decrement `InventoryItem.quantity`
   - create an `InventoryMovement` issue record
   - throw `InsufficientStockException` if the request cannot be fully satisfied

Planning implication:

- Phase 7 needs an explicit inventory-consumption API or equivalent service entrypoint even though downstream modules such as sales or manufacturing do not exist yet
- otherwise SC-04 and SC-06 have nowhere to execute

### 4. Keep the PO workflow strict and explicit

The roadmap and context already lock the lifecycle and rejection loop. The runtime should implement PO transitions as service-layer rules, not ad hoc status updates.

Recommended behavior:

- `DRAFT` -> `SUBMITTED`
- `SUBMITTED` -> `APPROVED` or `REJECTED`
- `REJECTED` -> `DRAFT`
- `APPROVED` -> `SENT_TO_VENDOR` only via an explicit action
- receipt posting moves POs into `PARTIALLY_RECEIVED` / `FULLY_RECEIVED`
- `CLOSED` remains explicit once receiving is complete and no more edits should occur

Planning implication:

- PO edit rules belong in service-layer transition checks
- material line edits after submission should be blocked unless the PO returns to `DRAFT`

### 5. Reorder automation should be queue-backed and tenant-safe

SC-03 requires a 6-hour reorder cron. The repo already favors BullMQ repeatable jobs with explicit tenant payloads.

Recommended shape:

- add `EVERY_6_HOURS` to `apps/api/src/common/schedule/schedule.ts`
- register one repeatable reorder job per tenant
- worker uses `this.prisma.forTenant(tenantId)` only
- worker computes tenant-wide available stock for each configured replenishment item:
  - sum on-hand inventory across warehouses
  - subtract reserved quantity
- worker suppresses PO creation when an open PO already exists in:
  - `DRAFT`
  - `SUBMITTED`
  - `APPROVED`
  - `SENT_TO_VENDOR`
  - `PARTIALLY_RECEIVED`
- worker creates a draft PO only when:
  - available stock <= `reorderPoint`
  - replenishment config exists
  - vendor is `ACTIVE`

When reorder cannot act because config is missing or vendor is blocked:

- skip the product
- persist a durable operator-visible reason using `OutboxEvent` and/or `Notification`

### 6. Preserve AP/AR compatibility

AP three-way matching already depends on `PurchaseOrder` and `GoodsReceipt`. Phase 7 should not silently break those assumptions.

Planning implication:

- goods receipt changes should preserve PO/receipt relationships already used in AP/AR
- the AP/AR harness and tests may need to evolve if `GoodsReceipt` becomes warehouse-targeted
- receipt posting should remain compatible with payable-side three-way matching logic

### 7. Add shared supply-chain contracts early

Create a dedicated `packages/types/src/supply-chain.ts` for domain exceptions and shared contracts.

Recommended exceptions:

- `InvalidPurchaseOrderTransitionException`
- `GoodsReceiptQuantityExceededException`
- `InsufficientStockException`
- `MissingReplenishmentConfigurationException`
- `VendorPurchasingBlockedException`

Why this matters:

- the rest of the repo already centralizes domain exceptions in `@amdox/types`
- supply-chain logic will need stable HTTP/error mapping and test assertions

## Domain Rules The Planner Should Treat As Locked

### Goods receipt and inventory behavior

- one goods receipt targets one warehouse
- split physical deliveries are modeled as multiple receipts
- receipt posting updates PO received quantity, warehouse inventory, and FIFO layers atomically
- no receipt may overrun the remaining PO quantity

### FIFO behavior

- new FIFO layers use PO line price
- no receipt-time cost override in Phase 7
- depletion is oldest-first within the same product and warehouse
- insufficient stock fails before any partial depletion

### Reorder behavior

- available stock is tenant-wide on-hand minus reserved quantity
- reorder automation requires explicit sourcing config
- reorder automation must never guess vendor or legal entity
- open PO states block duplicate reorder drafts

### Purchasing controls

- only `ACTIVE` vendors can be used for new purchasing
- rejected POs loop back to `DRAFT`
- `APPROVED` -> `SENT_TO_VENDOR` is explicit
- post-draft material edits require a return to `DRAFT`

## Risks And Planning Traps

### 1. Goods receipt still lacks a warehouse target

If planning skips this schema change, inventory updates and FIFO layer creation will either become implicit or wrong. This is the highest-risk Phase 7 modeling gap.

### 2. Reorder automation has no source-of-truth quantity or sourcing config yet

If planning assumes `reorderPoint` alone is enough, execution will either:

- guess vendor/legal entity, violating context, or
- create unusable draft POs with no quantity rule

### 3. FIFO can be faked without a real consumption path

It is easy to create cost layers on receipt and still never prove oldest-first depletion. Plans must include an explicit stock-consumption service and test path.

### 4. AP/AR compatibility can regress if goods-receipt changes are isolated

Three-way matching already reads PO and goods-receipt relationships. Schema or service changes that ignore this will create Phase 4 regressions.

### 5. Schedule helper is incomplete for SC-03

The repo has a cron helper, but only for a daily schedule. Reorder automation planning must include the 6-hour schedule path rather than assuming it exists already.

### 6. Test harness drift risk is real

Like finance, AP/AR, HR, and payroll, this phase will need a dedicated in-memory harness to keep unit and integration tests aligned with the evolved schema. If the harness is skipped, execution will drift into brittle ad hoc mocks.

## Recommended Plan Shape

Phase 7 is best split into four plans:

### Plan A: Supply-chain schema, shared contracts, and harness

- add receipt warehouse targeting
- add replenishment config and inventory movement persistence
- add shared supply-chain exceptions/contracts
- add a dedicated supply-chain test harness
- push/regenerate Prisma before module work

### Plan B: Supply-chain module, master data, and PO lifecycle APIs

- scaffold the NestJS module
- add vendor/product/warehouse/replenishment APIs
- add PO create/read/transition flows
- enforce active-vendor and draft-only edit rules

### Plan C: Goods receipts, FIFO consumption, and reorder automation

- implement receipt posting and PO status advancement
- implement FIFO stock issue + `InsufficientStockException`
- implement the 6-hour reorder job and operator-visible skip reasons

### Plan D: Integration coverage and validation sign-off

- API integration tests for supply-chain flows and tenant isolation
- job/integration coverage for reorder behavior
- update the validation artifact with real verification coverage

This order keeps schema and sourcing decisions stable before runtime behavior, then finishes with test-backed sign-off.

## Testing And Verification Guidance

### Minimum automated coverage

- unit tests for PO lifecycle transitions, including rejection -> `DRAFT`
- unit tests for goods receipt partial/full status updates
- unit tests for FIFO layer creation and oldest-first depletion
- unit tests for `InsufficientStockException`
- unit tests for reorder suppression when open POs already exist
- unit or integration tests for reorder skips when replenishment config is missing
- API integration tests for tenant isolation and role-based access

### Build/test contract

Keep using the repo's existing commands:

- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`

Do not introduce watch-mode or source-direct assumptions; the repo's tests still import built `dist` artifacts.

## Validation Architecture

The Phase 7 plans should be validated across four dimensions:

1. **Requirements coverage**: every `SC-01` to `SC-06` requirement is claimed by at least one plan
2. **Decision fidelity**: all locked context decisions appear in plan objectives or tasks, especially:
   - single-warehouse goods receipts
   - PO-price FIFO layers
   - tenant-wide available-stock evaluation
   - explicit sourcing configuration for reorder
   - strict PO/vendor controls
3. **Cross-module integrity**: plans preserve AP/AR three-way-match compatibility and use existing tenant-safe BullMQ patterns
4. **Operational integrity**: plans include durable error signaling, blocking stock checks, and automated verification rather than prose-only promises

Recommended blocking checks for the later plan checker:

- block if no task adds a warehouse target to goods receipts
- block if no task adds explicit replenishment configuration and reorder quantity/source data
- block if no task implements a real stock-consumption path and `InsufficientStockException`
- block if any plan allows reorder automation to infer vendor or legal entity heuristically
- block if no test task covers rejection -> `DRAFT`, FIFO depletion, and goods-receipt inventory updates

## Bottom Line

Phase 7 is feasible with the current architecture, but only if planning treats it as a real inventory-domain phase rather than "just PO CRUD."

The strongest implementation path in this repo is:

- fix the schema and sourcing gaps first
- build strict purchasing APIs second
- wire receipt/FIFO/reorder behavior third
- finish with integration-backed validation

That sequence matches the repo's existing module and test patterns while keeping AP/AR compatibility intact.

## RESEARCH COMPLETE
