# Phase 7: Supply Chain & Inventory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 07-supply-chain-inventory
**Areas discussed:** Goods Receipt Destination, FIFO Cost Layer Pricing, Reorder Automation Scope, PO Lifecycle Controls, Vendor Usage Rules

---

## Goods Receipt Destination

| Option                                                                          | Description                                                                    | Selected |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| One goods receipt targets one warehouse; split deliveries are separate receipts | Keeps receipt posting aligned with warehouse-scoped inventory and FIFO layers. | yes      |
| One goods receipt can mix warehouses line by line                               | Allows one receipt to distribute stock to multiple warehouses in one document. |          |
| Warehouse is optional and inferred from vendor or PO defaults                   | Reduces operator input but relies on implicit routing logic.                   |          |

**User's choice:** Recommended option accepted.
**Notes:** This closes the biggest current modeling gap because inventory and cost layers are warehouse-specific while `GoodsReceipt` does not yet capture destination warehouse.

---

## FIFO Cost Layer Pricing

| Option                                                                      | Description                                                          | Selected |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| New FIFO layers use PO unit price; no receipt-time cost override in Phase 7 | Keeps FIFO deterministic and aligned with agreed purchasing cost.    | yes      |
| Receiver may override unit cost while posting the receipt                   | Supports receipt-time variance handling and manual cost adjustments. |          |
| Ignore PO price and create receipt layers from averaged inventory cost      | Simplifies posting but breaks strict FIFO receipt costing.           |          |

**User's choice:** Recommended option accepted.
**Notes:** Landed-cost and purchase-price-variance handling were intentionally deferred to keep Phase 7 focused on core FIFO behavior.

---

## Reorder Automation Scope

| Option                                                                                                                          | Description                                                                              | Selected |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Evaluate tenant-wide available stock and require explicit replenishment config for vendor/legal entity; skip ambiguous products | Matches the current product-scoped `reorderPoint` model and avoids heuristic purchasing. | yes      |
| Evaluate each warehouse independently using the same product reorder point                                                      | Treats reorder as warehouse-local even though thresholds are not modeled per warehouse.  |          |
| Reorder from the last-receiving warehouse/vendor automatically                                                                  | Minimizes new configuration but relies on inferred sourcing.                             |          |

**User's choice:** Recommended option accepted.
**Notes:** This keeps success criterion 2 achievable without pretending the current schema already supports warehouse-local replenishment policy or vendor-selection heuristics.

---

## PO Lifecycle Controls

| Option                                                                                                                   | Description                                                                | Selected |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------- |
| Explicit transitions; edits only in `DRAFT`; rejection returns PO to `DRAFT`; `APPROVED` -> `SENT_TO_VENDOR` is explicit | Preserves a strict procurement workflow and matches the roadmap lifecycle. | yes      |
| Auto-send to vendor immediately on approval                                                                              | Removes an operator step between approval and vendor dispatch.             |          |
| Allow edits after submission or approval without resetting workflow                                                      | Maximizes flexibility but weakens approval integrity.                      |          |

**User's choice:** Recommended option accepted.
**Notes:** The success criterion already locks the rejection -> `DRAFT` loop, so the remaining decision was how strict edits and vendor-send transitions should be.

---

## Vendor Usage Rules

| Option                                                                                                          | Description                                                                       | Selected |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Only `ACTIVE` vendors may be used for new or auto-generated POs; existing open POs may still complete receiving | Protects new purchasing while avoiding operational deadlocks on in-flight orders. | yes      |
| Allow `INACTIVE` vendors with warning, block only `BLACKLISTED`                                                 | Softens enforcement for manual operator choices.                                  |          |
| Allow any vendor status and treat status as informational only                                                  | Maximizes flexibility but weakens procurement controls.                           |          |

**User's choice:** Recommended option accepted.
**Notes:** This keeps vendor status meaningful without blocking warehouse receiving for stock already ordered before the vendor status changed.

---

## the agent's Discretion

- Exact schema shape for replenishment configuration
- Exact API and service split across vendor, PO, receipt, inventory, and costing concerns
- Exact scheduler/queue wiring for the six-hour reorder job
- Exact error wording and outbox/notification payload shapes

## Deferred Ideas

- Warehouse-specific reorder thresholds
- Inter-warehouse transfer and rebalancing
- Landed-cost allocation and purchase-price variance
- Heuristic or multi-vendor auto-sourcing
