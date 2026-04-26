# Plan 14-01 Summary

- Added DTO-backed auth inputs with `LoginDto`, `RefreshTokenDto`, `LogoutDto`, and `VerifyMfaDto`.
- Introduced the Phase 14 session ledger in `packages/db/prisma/schema.prisma` with `UserSession` and `UserSessionStatus`.
- Refactored `AuthService` to hash refresh tokens, reject replay, block a 6th active session, and revoke session rows on logout/refresh failure.
- Extended JWT and tenant request context so downstream code can see `sessionId`, `jti`, `effectiveTenantId`, and `actingTenantOverride`.
- Verification is still blocked here because Prisma generate/build/test could not run without `node.exe`.
