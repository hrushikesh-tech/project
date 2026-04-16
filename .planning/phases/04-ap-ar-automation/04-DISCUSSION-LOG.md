# Phase 4: AP/AR Automation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 04-ap-ar-automation
**Areas discussed:** Invoice lifecycle, Auto-posting policy, Posting strictness, Mismatch notification behavior, Aging report contract

---

## Invoice lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Create draft invoice on partial/failed OCR | Persist the invoice and mark it reviewable with a reason | ✓ |
| Reject failed OCR imports | Require re-upload instead of keeping a reviewable draft | |
| Other | User-defined alternative | |

**User's choice:** Create a draft invoice even when OCR is partial or fails, and keep it reviewable with an explicit reason.
**Notes:** Re-upload should not be the default recovery path.

---

## Auto-posting policy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-post AP only | Only AP invoices that pass 3-way match auto-post; AR stays review-first | ✓ |
| Auto-post AP and AR | Both AP and AR auto-post once extraction is complete | |
| Never auto-post | Require manual approval for every invoice | |

**User's choice:** Auto-post only AP invoices that pass 3-way match.
**Notes:** AR remains review-first in Phase 4.

---

## Posting strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Require explicit control accounts | Vendor/customer posting accounts must be explicitly configured before posting | ✓ |
| Allow entity-default fallbacks | Missing control accounts may fall back to entity defaults | |
| Other | User-defined alternative | |

**User's choice:** Require explicit vendor/customer control-account configuration before posting.
**Notes:** Missing configuration should route to review instead of silently picking fallback accounts.

---

## Mismatch notification behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Outbox + lightweight in-app notifications | Persist durable events and create finance-facing notifications now | ✓ |
| Outbox only | Persist durable events now and defer user-visible notifications to Phase 11 | |
| Other | User-defined alternative | |

**User's choice:** Create both durable `OutboxEvent` records and lightweight in-app finance notifications now.
**Notes:** Phase 4 should not wait for the full notification engine to make mismatches visible.

---

## Aging report contract

| Option | Description | Selected |
|--------|-------------|----------|
| Unified endpoint with type + summary + drill-down | One contract handles AP and AR with totals and invoice rows | ✓ |
| Separate AP and AR endpoints | Split the aging surface by payable vs receivable | |
| Unified totals only | One endpoint, but no invoice drill-down rows | |

**User's choice:** Use one unified aging endpoint with `type=PAYABLE|RECEIVABLE`, summary totals, and invoice-level drill-down rows.
**Notes:** Keep the report surface consolidated unless a later phase creates a stronger reason to split it.

---

## the agent's Discretion

- Exact OCR provider wiring and fallback implementation details
- Exact manual review field-edit experience and review action semantics
- Additional optional aging-report filters beyond the required contract
- Exact finance-notification recipient selection details

## Deferred Ideas

None.
