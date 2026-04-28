# ADR 0002: Keep the API as a NestJS Modular Monolith

**Status:** Accepted
**Date:** 2026-04-28

## Context

The ERP backend has many business domains, but they share the same core concerns: tenant isolation, transactionality, auditability, and a common authentication model. Splitting the backend into many deployed microservices would add orchestration and consistency overhead before the product needs it.

## Decision

Keep `apps/api` as a modular NestJS monolith.

## Consequences

- domain modules can share the same auth, tenant, validation, and audit infrastructure
- the API can keep a single versioned HTTP surface at `/api/v1`
- testing is simpler because most workflows stay inside one process boundary
- module boundaries must be maintained deliberately so the codebase does not drift into a single unstructured service

## Implementation Notes

- `AppModule` composes finance, AP/AR, HR, payroll, supply chain, forecasting, BI, GDPR, project, and notifications modules
- `main.ts` sets the global prefix, versioning, security headers, telemetry, and API docs
- the worker runtime remains a separate process for queued work, but the API owns the business module boundary
