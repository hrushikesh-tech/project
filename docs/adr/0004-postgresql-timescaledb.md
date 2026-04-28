# ADR 0004: Use PostgreSQL as the ERP System of Record

**Status:** Accepted
**Date:** 2026-04-28

## Context

The platform stores financial, HR, payroll, BI, notification, audit, and compliance data. Those workloads need ACID semantics, relational joins, tenant-aware queries, and predictable retention behavior.

## Decision

Use PostgreSQL as the primary system of record. The cloud foundation targets Aurora PostgreSQL in AWS, and the data model remains compatible with time-series style retention and audit workloads.

## Consequences

- Prisma can remain the application data access layer
- tenant isolation and audit flows stay relational and transactional
- retention and pseudonymisation can be expressed in application logic where the law requires selective cleanup
- the platform should not depend on a different primary datastore for core ERP workflows

## Implementation Notes

- `DATABASE_URL` is the main connection entrypoint in `.env.example`
- the API and GDPR flows use tenant-scoped database access
- the cloud foundation provisions Aurora PostgreSQL as the managed backend in AWS
