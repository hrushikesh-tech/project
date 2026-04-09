# Phase 1: Environment Setup & Monorepo Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 1-Environment Setup & Monorepo Scaffold
**Areas discussed:** Repository Structure, Docker Compose Architecture, Linting & Rule Strictness

---

## Repository Structure

| Option                            | Description                                                                                                 | Selected |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Overwrite root vs preserve legacy | Scaffold directly in the root, moving current `frontend` and `backend` to a `legacy/` folder for reference. | ✓        |

**User's choice:** Auto (Selected default recommendation)
**Notes:**

---

## Docker Compose Architecture

| Option                  | Description                                                                                                                                           | Selected |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Single file vs separate | Single `docker-compose.yml` at the root for backing services only (DB, Redis, Keycloak, Elasticsearch, Mailpit) — Next/Nest/FastAPI run via pnpm dev. | ✓        |

**User's choice:** Auto (Selected default recommendation)
**Notes:**

---

## Linting & Rule Strictness

| Option             | Description                                                                                  | Selected |
| ------------------ | -------------------------------------------------------------------------------------------- | -------- |
| Strict vs Standard | Strict TypeScript + recommended ESLint rules. Best to enforce quality from day 1 for an ERP. | ✓        |

**User's choice:** Auto (Selected default recommendation)
**Notes:**
