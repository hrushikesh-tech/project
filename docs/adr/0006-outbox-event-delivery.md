# ADR 0006: Use the Outbox Pattern for Durable Event Delivery

**Status:** Accepted
**Date:** 2026-04-28

## Context

ERP workflows need reliable downstream notifications, auditability, and worker-triggered follow-up processing. Directly publishing events from business code would make delivery harder to reason about under failure.

## Decision

Use the outbox pattern: write the event in the same transaction as the business change, then deliver it asynchronously.

## Consequences

- business mutations and event creation stay consistent
- downstream delivery can retry without losing the original transaction
- workers can poll or process the outbox without coupling the business transaction to the delivery path
- idempotency and replay behavior need to be part of the worker contract

## Implementation Notes

- the notifications and worker modules already reflect the same durability-first direction
- audit and GDPR request flows remain traceable alongside the main business records
- the architecture overview and runbooks should treat event delivery as asynchronous and operationally observable
