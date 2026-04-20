---
phase: 07
slug: supply-chain-inventory
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-18
verified_at: 2026-04-19
---

# Phase 07 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| **Framework**          | Node `--test` + Nest integration tests                                   |
| **Config file**        | `apps/api/package.json`                                                  |
| **Quick run command**  | `pnpm --filter @amdox/api run test:unit`                                 |
| **Full suite command** | `pnpm --filter @amdox/api run test:integration`                          |
| **Estimated runtime**  | ~35 seconds for the verified unit + integration path in this environment |

---

## Sampling Rate

- Execution closeout used the real package scripts:
  - `pnpm --filter @amdox/api run test:unit`
  - `pnpm --filter @amdox/api run test:integration`
- Targeted compatibility checks also passed for:
  - `node --test --test-isolation=none test/unit/three-way-match.service.test.mjs test/integration/apar.api.test.mjs`
- The integration suite required an unsandboxed rerun because the browser-backed payroll PDF test hit `spawn EPERM` inside the sandbox even though it passed with local browser access.

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                | Threat Ref | Secure Behavior                                                                                   | Test Type        | Automated Command                               | File Exists | Status |
| -------- | ---- | ---- | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------- | ----------- | ------ |
| 07-01-01 | 01   | 1    | SC-03, SC-04, SC-05, SC-06 | T-07-01    | Receipt warehouse targeting, sourcing config, and stock ledger remain tenant-scoped and auditable | unit             | `pnpm --filter @amdox/api run test:unit`        | yes         | green  |
| 07-02-03 | 02   | 2    | SC-01, SC-02               | T-07-02    | PO transitions and vendor gating enforce approved purchasing rules without illegal edits          | unit             | `pnpm --filter @amdox/api run test:unit`        | yes         | green  |
| 07-03-02 | 03   | 3    | SC-04, SC-06               | T-07-03    | FIFO depletion is oldest-first and blocks partial stock issue on insufficient inventory           | unit/integration | `pnpm --filter @amdox/api run test:unit`        | yes         | green  |
| 07-03-03 | 03   | 3    | SC-03                      | T-07-04    | Reorder automation is tenant-safe, never guesses sourcing, and suppresses duplicate open POs      | integration      | `pnpm --filter @amdox/api run test:integration` | yes         | green  |
| 07-04-01 | 04   | 4    | SC-01, SC-02, SC-05        | T-07-05    | API flows remain role-safe, tenant-safe, and receipt updates are externally verifiable            | integration      | `pnpm --filter @amdox/api run test:integration` | yes         | green  |

_Status: pending, green, red, or flaky_

---

## Wave 0 Requirements

- [x] `apps/api/test/helpers/supply-chain-test-store.mjs` - shared vendor, PO, warehouse, receipt, replenishment, and FIFO fixtures
- [x] `apps/api/test/unit/supply-chain.purchase-orders.test.mjs` - PO lifecycle and vendor-gating coverage
- [x] `apps/api/test/unit/supply-chain.inventory-reorder.test.mjs` - FIFO depletion, stock blocking, and reorder decision coverage
- [x] `apps/api/test/integration/supply-chain.api.test.mjs` - API and tenant-isolation coverage for supply-chain flows
- [x] `apps/api/test/integration/supply-chain.jobs.test.mjs` - reorder worker coverage and durable skip/create behavior

---

## Manual-Only Verifications

All Phase 7 behaviors should be automatable. No manual-only verification is planned at this stage.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified on 2026-04-19 after `db:push`, `@amdox/db` build, `@amdox/types` build, `@amdox/api` build, full API unit suite, and full API integration suite.
