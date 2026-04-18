---
phase: 07
slug: supply-chain-inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 07 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | Node `--test` + Nest integration tests                                                    |
| **Config file**        | `apps/api/package.json`                                                                   |
| **Quick run command**  | `pnpm --filter @amdox/api run test:unit`                                                  |
| **Full suite command** | `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration` |
| **Estimated runtime**  | ~120 seconds for unit + integration in this environment                                   |

---

## Sampling Rate

- After every task commit: run `pnpm --filter @amdox/api run test:unit`
- After every plan wave: run `pnpm --filter @amdox/api run test:unit && pnpm --filter @amdox/api run test:integration`
- Before `/gsd-verify-work`: full suite must be green
- Max feedback latency: 120 seconds for unit/integration feedback

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                | Threat Ref | Secure Behavior                                                                                   | Test Type        | Automated Command                               | File Exists | Status  |
| -------- | ---- | ---- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------- | ----------- | ------- |
| 07-01-01 | 01   | 1    | SC-03, SC-04, SC-05, SC-06 | T-07-01    | Receipt warehouse targeting, sourcing config, and stock ledger remain tenant-scoped and auditable | unit             | `pnpm --filter @amdox/api run test:unit`        | no          | pending |
| 07-02-03 | 02   | 2    | SC-01, SC-02               | T-07-02    | PO transitions and vendor gating enforce approved purchasing rules without illegal edits          | unit             | `pnpm --filter @amdox/api run test:unit`        | no          | pending |
| 07-03-02 | 03   | 3    | SC-04, SC-06               | T-07-03    | FIFO depletion is oldest-first and blocks partial stock issue on insufficient inventory           | unit/integration | `pnpm --filter @amdox/api run test:unit`        | no          | pending |
| 07-03-03 | 03   | 3    | SC-03                      | T-07-04    | Reorder automation is tenant-safe, never guesses sourcing, and suppresses duplicate open POs      | integration      | `pnpm --filter @amdox/api run test:integration` | no          | pending |
| 07-04-01 | 04   | 4    | SC-01, SC-02, SC-05        | T-07-05    | API flows remain role-safe, tenant-safe, and receipt updates are externally verifiable            | integration      | `pnpm --filter @amdox/api run test:integration` | no          | pending |

_Status: pending, green, red, or flaky_

---

## Wave 0 Requirements

- [ ] `apps/api/test/helpers/supply-chain-test-store.mjs` - shared vendor, PO, warehouse, receipt, replenishment, and FIFO fixtures
- [ ] `apps/api/test/unit/supply-chain.purchase-orders.test.mjs` - PO lifecycle and vendor-gating coverage
- [ ] `apps/api/test/unit/supply-chain.inventory-reorder.test.mjs` - FIFO depletion, stock blocking, and reorder decision coverage
- [ ] `apps/api/test/integration/supply-chain.api.test.mjs` - API and tenant-isolation coverage for supply-chain flows
- [ ] `apps/api/test/integration/supply-chain.jobs.test.mjs` - reorder worker coverage and durable skip/create behavior

---

## Manual-Only Verifications

All Phase 7 behaviors should be automatable. No manual-only verification is planned at this stage.

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
