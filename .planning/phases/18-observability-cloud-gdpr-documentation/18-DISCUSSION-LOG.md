# Phase 18: Observability, Cloud, GDPR & Documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 18-observability-cloud-gdpr-documentation
**Areas discussed:** Observability shape, Cloud boundary, GDPR operating model, Documentation contract

---

## Observability shape

| Option            | Description                                                                                                    | Selected |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Application-first | Instrument app runtimes and business flows first, with dashboards/alerts focused mainly on application health. |          |
| Full platform     | Cover app plus deep infrastructure/platform observability as a first-class Phase 18 deliverable.               |          |
| Hybrid            | Make app telemetry the hard requirement and add a thin layer of platform golden signals.                       | yes      |

**User's choice:** Hybrid
**Notes:** Application telemetry is the priority. Platform coverage should exist, but only as a bounded golden-signal layer rather than a full platform-observability buildout.

---

## Cloud boundary

| Option                              | Description                                                                                                         | Selected |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Foundation only                     | Provision core AWS resources for the existing deployment shape and keep the rest with Helm/ArgoCD.                  |          |
| Foundation plus platform glue       | Provision AWS foundation plus the IAM, storage, and environment wiring needed to make the existing platform usable. | yes      |
| Near-complete environment bootstrap | Expand Terraform toward a more opinionated end-to-end environment bootstrap.                                        |          |

**User's choice:** Foundation plus platform glue
**Notes:** Terraform should own the AWS base and shared integration glue, but should not absorb all deployment/runtime responsibilities.

---

## GDPR operating model

| Option                            | Description                                                                                                  | Selected |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| Strict privacy-first              | Aggressively remove or pseudonymise data wherever possible, even when that weakens historical readability.   |          |
| Audit-first with privacy controls | Preserve legally significant records while pseudonymising PII and deleting sessions/files where appropriate. | yes      |
| Tiered by data class              | Define separate handling rules for multiple classes of data and records.                                     |          |

**User's choice:** Audit-first with privacy controls
**Notes:** The ERP's finance and audit history must remain trustworthy. Privacy handling should automate export, pseudonymisation, deletion where allowed, and traceable completion within the required time window.

---

## Documentation contract

| Option                 | Description                                                                                                         | Selected |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Developer-first        | Prioritize setup, local workflows, env vars, and API docs for engineers.                                            |          |
| Operator-first         | Prioritize runbooks, deployment topology, observability, and operations handoff.                                    |          |
| Balanced platform docs | Provide one strong entrypoint with focused guidance for developers, operators, and architecture/compliance readers. | yes      |

**User's choice:** Balanced platform docs
**Notes:** Documentation should serve onboarding, operations, and architecture/compliance together rather than optimizing for only one audience.

---

## the agent's Discretion

- Exact telemetry bootstrap, dashboard layout, alert-rule structure, and Terraform module layout
- Exact pseudonymisation mechanics and DSR job orchestration details
- Exact documentation file organization across README, runbooks, ADRs, and API references

## Deferred Ideas

- Full platform-observability expansion beyond a thin golden-signal layer
- Terraform ownership beyond AWS foundation plus shared platform glue
- GDPR erasure behavior that would compromise legally required finance or audit history
- Documentation optimized exclusively for one audience at the expense of the others
