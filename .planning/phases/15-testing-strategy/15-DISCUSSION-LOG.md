# Phase 15: Testing Strategy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `15-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 15-testing-strategy
**Areas discussed:** Coverage gate, Integration test contract, E2E journey definition, Test utilities scope, Load test focus

---

## Coverage Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Hard per-service floor | Core service files must each meet `>=80%`, thinner controller/DTO layers are advisory only | yes |
| Repo-wide floor | Overall backend/frontend coverage must hit `>=80%`, without per-service enforcement | |
| Hard broad floor | Nearly every package/module is expected to meet `>=80%` | |

**User's choice:** `1a`
**Notes:** The user selected the recommended option, keeping the hard floor focused on meaningful service logic rather than thin transport files.

---

## Integration Test Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Harness matrix only | Full endpoint matrix uses the existing harness-backed Nest integration style | |
| Harness matrix plus live smoke | Keep the full harness matrix and add a smaller real-stack smoke suite against live Postgres, Redis, and auth | yes |
| Real-stack heavy | Shift heavily toward live-stack integration even if the total matrix becomes smaller | |

**User's choice:** `2b`
**Notes:** The user selected the recommended option, preserving the fast broad matrix while adding a higher-fidelity smoke layer for runtime truth.

---

## E2E Journey Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Formalize current specs | Mostly formalize the existing Phase 12 Playwright flows as the required 8 journeys | |
| Business journeys with reuse | Reframe the required set as cross-module business journeys and reuse existing Phase 12 specs where possible | yes |
| New set from scratch | Define a new E2E journey set without anchoring to the current suite | |

**User's choice:** `3b`
**Notes:** The user selected the recommended option so the journey set stays product-level while still reusing proven Playwright work.

---

## Test Utilities Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Standardize existing helpers first | Clean up and standardize the current helper and harness surface before expanding realism further | yes |
| Build a more realistic shared fixture system | Invest first in a more realistic fixture architecture even if the phase grows materially | |
| Do both aggressively | Pursue helper cleanup and realism upgrades aggressively in the same phase | |

**User's choice:** `4a`
**Notes:** The user selected the recommended option, favoring practical consolidation of the current helpers and harnesses.

---

## Load Test Focus

| Option | Description | Selected |
|--------|-------------|----------|
| API-heavy mixed workload | Focus k6 on auth, common CRUD, BI reads, and a bounded set of heavier routes | yes |
| Broad ERP simulation | Try to simulate a wider ERP workload with many heavy flows | |
| Narrow hot-path focus | Concentrate mostly on login/session and a small set of hot endpoints | |

**User's choice:** `5a`
**Notes:** The user selected the recommended option so the load layer stays honest, focused, and aligned with the platform SLA.

---

## the agent's Discretion

- Exact file-level coverage threshold mechanics
- Exact composition of the real-stack smoke layer
- Exact mapping from existing Playwright specs to the 8 formal business journeys
- Exact shared-helper layout and fixture API surface
- Exact k6 scenario mix and weighting

## Deferred Ideas

- Replacing the current test framework stack wholesale
- Treating Phase 15 as a CI/CD or observability phase instead of a testing-consolidation phase
