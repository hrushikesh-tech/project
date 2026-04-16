---
phase: 04
slug: ap-ar-automation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 04 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner + NestJS integration harness |
| **Config file** | `apps/api/package.json` |
| **Quick run command** | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw` |
| **Full suite command** | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw`
- **After every plan wave:** Run `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | APAR-01, APAR-03, APAR-04, APAR-06 | T-04-01 | AP/AR records remain legal-entity scoped and posting-capable | build | `pnpm --filter @amdox/db generate && pnpm --filter @amdox/api build` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | APAR-01, APAR-02, APAR-03, APAR-04, APAR-05, APAR-06 | T-04-02 | Status enums prevent ambiguous worker and review states | unit | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 1 | APAR-03, APAR-04, APAR-05, APAR-06 | T-04-03 | Test harness can simulate tenant-safe AP/AR data and outbox flows | unit | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | APAR-01, APAR-02 | T-04-04 | Queue and provider dependencies are installed once and wired centrally | build | `pnpm --filter @amdox/api build` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | APAR-01 | T-04-05 | Upload path rejects bad MIME/magic bytes and oversized files before storage | integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:integration:raw` | ✅ | ⬜ pending |
| 04-02-03 | 02 | 2 | APAR-01, APAR-02 | T-04-06 | OCR worker is idempotent and keeps failed documents in reviewable state | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw` | ✅ | ⬜ pending |
| 04-02-04 | 02 | 2 | APAR-01, APAR-02 | T-04-07 | OCR extraction persists normalized data without bypassing tenant scope | unit | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | APAR-03 | T-04-08 | Match logic enforces PO, quantity, amount, and similarity thresholds | unit | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw` | ✅ | ⬜ pending |
| 04-03-02 | 03 | 3 | APAR-04 | T-04-09 | Auto-posting writes into the correct legal entity and control accounts only | integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:integration:raw` | ✅ | ⬜ pending |
| 04-03-03 | 03 | 3 | APAR-05 | T-04-10 | Mismatch handling persists durable outbox/notification records | integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:integration:raw` | ✅ | ⬜ pending |
| 04-03-04 | 03 | 3 | APAR-06 | T-04-11 | Aging buckets are computed from due dates and open statuses deterministically | unit/integration | `pnpm --filter @amdox/api build && pnpm --filter @amdox/api test:unit:raw && pnpm --filter @amdox/api test:integration:raw` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Textract end-to-end extraction against real AWS credentials | APAR-02 | Local/unit tests should stub cloud OCR providers | Upload a representative invoice PDF in a dev environment with valid AWS credentials and confirm extracted fields populate `Invoice` and `InvoiceLine` rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
