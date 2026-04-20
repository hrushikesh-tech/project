---
phase: 08
slug: ai-ml-demand-forecasting
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-20
updated: 2026-04-21
---

# Phase 08 - Validation Strategy

Per-phase validation contract and execution record for AI/ML demand forecasting.

---

## Test Infrastructure

| Property                  | Value                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Framework                 | Python `pytest` plus Node `--test` suites                                          |
| Config file               | `apps/api/package.json`, `apps/ml-service/package.json`                            |
| Quick run command         | `pnpm --filter @amdox/api run test:unit`                                           |
| Full suite command        | `pnpm --filter @amdox/api run test:integration`                                    |
| Python suite command      | `.venv\Scripts\python.exe -m pytest tests -q`                                      |
| Current verification note | Full Python suite executed successfully in a local Python 3.12 virtual environment |

---

## Commands Run

| Command                                                                                                         | Result | Notes                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `pnpm --filter @amdox/db generate`                                                                              | pass   | Regenerated Prisma client after schema changes                                      |
| `pnpm --filter @amdox/types build`                                                                              | pass   | Rebuilt shared runtime exports for new forecasting errors/types                     |
| `pnpm --filter @amdox/api build`                                                                                | pass   | NestJS forecasting module compiled successfully                                     |
| `pnpm --filter @amdox/api run test:unit:raw`                                                                    | pass   | Includes new forecasting service unit coverage                                      |
| `node --test --test-isolation=none test/integration/forecasting.jobs.test.mjs`                                  | pass   | Verifies weekly retraining, promotion, rejection, and persistence                   |
| `node --test --test-isolation=none test/unit/forecasting.service.test.mjs`                                      | pass   | Direct forecasting service coverage                                                 |
| `python -m py_compile apps/ml-service/main.py apps/ml-service/app/schemas.py apps/ml-service/app/services/*.py` | pass   | Syntax validation only                                                              |
| Python service smoke script for Prophet train plus predict plus health snapshot                                 | pass   | Direct service-level verification without external Python deps                      |
| `.venv\Scripts\python.exe -m pytest tests -q`                                                                   | pass   | 8 tests passed in 14.13s on Python 3.12 virtual environment                         |
| `pnpm --filter @amdox/api run test:integration:raw`                                                             | pass   | Full API integration suite is green, including forecasting and payroll PDF coverage |

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                       | Threat Ref | Verification                                                                                 | Status |
| -------- | ---- | ---- | --------------------------------- | ---------- | -------------------------------------------------------------------------------------------- | ------ |
| 08-01-01 | 01   | 1    | ML-01, ML-03, ML-04, ML-05        | T-08-01    | Prisma generate plus Node forecasting harness/tests                                          | green  |
| 08-02-01 | 02   | 2    | ML-01, ML-02, ML-04, ML-05        | T-08-05    | Package layout created, syntax-checked, smoke-validated                                      | green  |
| 08-02-02 | 02   | 2    | ML-01, ML-02                      | T-08-05    | Python `pytest` proves Prophet path, LSTM 500-point gate, and early stopping behavior        | green  |
| 08-02-03 | 02   | 2    | ML-04, ML-05                      | T-08-04    | Python `pytest` proves prediction quality gate and confidence-bound responses                | green  |
| 08-03-01 | 03   | 3    | ML-03, ML-04, ML-05               | T-08-07    | API build plus forecasting controller/module compilation                                     | green  |
| 08-03-02 | 03   | 3    | ML-03                             | T-08-08    | `forecasting.jobs.test.mjs` covers weekly retraining from `ISSUE` demand only                | green  |
| 08-03-03 | 03   | 3    | ML-03, ML-05                      | T-08-09    | Unit and integration tests cover promote-only-if-better and `warehouseId = null` persistence | green  |
| 08-04-01 | 04   | 4    | ML-01, ML-02, ML-04, ML-05        | T-08-11    | Python tests executed successfully in local `.venv`                                          | green  |
| 08-04-02 | 04   | 4    | ML-03, ML-04, ML-05               | T-08-10    | Node forecasting unit and integration suites passing                                         | green  |
| 08-04-03 | 04   | 4    | ML-01, ML-02, ML-03, ML-04, ML-05 | T-08-12    | Validation artifact updated with real command outcomes                                       | green  |

---

## Wave 0 Requirements

- [x] `apps/api/test/helpers/forecast-test-store.mjs`
- [x] `apps/api/test/unit/forecasting.service.test.mjs`
- [x] `apps/api/test/integration/forecasting.jobs.test.mjs`
- [x] `apps/ml-service/tests/test_data_prep.py`
- [x] `apps/ml-service/tests/test_training_and_predict.py`

---

## Dependency Integrity

- Phase 7 is the explicit upstream source for Phase 8 demand history through tenant-safe `InventoryMovement` ledger data.
- Phase 8 produces durable forecast models and prediction snapshots for Phase 9 BI forecast-accuracy metrics.
- Phase 7, Phase 8, Phase 9, Phase 10, and Phase 11 remain explicit upstream dependencies for Phase 12 in `.planning/ROADMAP.md`.
- Phase 8 implementation keeps this chain aligned by persisting forecast outputs in the shared ERP data model rather than process-local storage.

## Residual Gaps

- No Phase 8-specific runtime validation gaps remain. Downstream phases 9, 10, 11, and 12 are still unbuilt, so only their contracts and dependency readiness are verified today.

---

## Validation Sign-Off

- [x] Wave 0 coverage exists for both runtimes
- [x] Node forecasting build and tests ran successfully
- [x] Python forecasting code passed syntax validation
- [x] Python forecasting services passed a direct smoke run
- [x] Full Python `pytest` suite executed
- [x] Repo-wide integration suite is fully green
- [x] `nyquist_compliant: true` is justified for the Phase 8 scope

Approval: Phase 8 scope verified
