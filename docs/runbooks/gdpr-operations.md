# GDPR Operations Runbook

This runbook describes the current subject-rights workflow in the API service. It is written for operators who need to verify the behavior in a real tenant environment without assuming a background job system that does not exist yet.

## Current Workflow Shape

The GDPR module handles requests inline in `apps/api/src/gdpr`:

- export requests create a tracked request row, gather the subject payload, encrypt it, and write an object to S3
- erasure requests pseudonymise allowed fields in place, revoke sessions, and remove file artifacts where the code permits
- retention policies are returned from the API as an explicit contract

The request is processed by the API service itself, not by a separate queue worker.

## Export Flow

Trigger an export with `POST /api/v1/gdpr/requests/export` as an authenticated user with tenant context.

What happens:

1. the API creates a GDPR request record with a trace ID
2. the service collects the subject data set from user, employee, session, notification, preference, payroll, payslip, dashboard, and audit records
3. the payload is serialized, encrypted with AES-256-GCM, and written to S3 under the configured export prefix
4. a signed download token is generated
5. the request is marked `EXPORT_READY`

Download the artifact with `GET /api/v1/gdpr/requests/:requestId/download?token=...`.

## Erasure Flow

Trigger erasure with `POST /api/v1/gdpr/requests/erasure`.

What happens:

1. the API creates a GDPR request record and marks it as processing
2. the subject user row is pseudonymised and deactivated
3. the employee row, if present, is redacted and marked terminated
4. payroll results and payslip metadata are redacted where allowed
5. notifications and notification preferences are soft-deleted
6. payslip artifacts are deleted from object storage
7. auth sessions are cleaned up
8. the request is marked `PSEUDONYMIZED`

## Retention Behavior

| Subject                               | Behavior              | Retention Window             | Notes                                                            |
| ------------------------------------- | --------------------- | ---------------------------- | ---------------------------------------------------------------- |
| GDPR request trace                    | Retain                | About 7 years (`2555` days)  | Keeps compliance evidence and audit traceability.                |
| Encrypted export artifact             | Delete                | `GDPR_EXPORT_RETENTION_DAYS` | Configured in `.env.example`.                                    |
| User session records                  | Pseudonymize / delete | Immediate on erasure         | Sessions are revoked and soft-deleted.                           |
| Regulated finance and payroll records | Pseudonymize          | About 7 years (`2555` days)  | Legal payload remains, direct identifiers are redacted in place. |
| Payslip artifacts                     | Delete                | Immediate on erasure         | Artifact cleanup happens from S3.                                |

The `GET /api/v1/gdpr/retention-policies` endpoint returns the same policy snapshot from the service.

## Manual Verification Boundaries

Use a non-production tenant with seeded data when validating this workflow.

- confirm the request state transitions in the API response and database
- confirm the export artifact is encrypted and the download token expires
- confirm erasure removes or redacts the intended fields but preserves regulated records
- confirm the storage bucket, Keycloak session cleanup, and database connection all exist in the target environment

Do not treat this workflow as a generic GDPR library. It is a platform-specific ERP compliance flow with business-record retention built into the implementation.

## Common Failure Modes

- missing `AWS_S3_BUCKET` or invalid S3 credentials
- missing export secrets
- tenant context not present on the authenticated user
- no export artifact yet when a download is attempted
- export or erasure attempts against data that the environment does not actually contain
