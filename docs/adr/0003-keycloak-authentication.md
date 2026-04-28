# ADR 0003: Use Keycloak for Identity and Session Control

**Status:** Accepted
**Date:** 2026-04-28

## Context

The platform needs SSO, role-based access, tenant-aware auth, token rotation, MFA-ready realms, and clear session cleanup semantics. Those requirements fit a centralized identity provider better than a custom credential store.

## Decision

Use Keycloak as the source of truth for authentication and session lifecycle control.

## Consequences

- the API can validate JWTs and tenant claims consistently
- session cleanup and logout behavior stay aligned with the identity system
- role and MFA policy live in one place instead of being reimplemented in the app
- the platform depends on an external identity service being reachable in the target environment

## Implementation Notes

- the API uses JWT, role, and tenant guards
- `apps/api/src/auth` handles auth service integration and cleanup paths
- `.env.example` keeps the Keycloak and auth-related environment contract explicit
