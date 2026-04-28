# Phase 18-04 Summary

## What Changed

- Added a new `gdpr` module with request/export/erasure endpoints and a persisted `GdprRequest` state machine.
- Implemented encrypted JSON export artifacts stored in S3 and a signed download token flow for export retrieval.
- Added audit-first erasure behavior that pseudonymizes user and employee identity fields, soft-deletes session and notification records, and removes payslip artifacts where present.
- Added explicit session cleanup in `AuthService` so subject erasure can revoke and soft-delete local session rows.
- Added retention-policy utilities and object-storage delete helpers to keep the cleanup behavior explicit instead of implied.

## Verification

- `pnpm --filter @amdox/db build`
- `pnpm --filter @amdox/api build`

Both commands passed after the Prisma client was regenerated.

## Blockers / Follow-Ups

- The workflow is stateful and traceable, but request processing still happens inline in the service rather than through a separate queue worker.
- I did not run the flow against live Keycloak, S3, or a seeded tenant database in this workspace, so the signed download path and storage cleanup remain compile-verified only.
- Any broader retention enforcement beyond the helper utilities added here still needs the dedicated background jobs from later slices.
