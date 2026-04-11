# Phase 2: Database Schema & Authentication — Research

**Researched:** 2026-04-12
**Phase:** 02-database-schema-authentication
**Status:** Complete

## 1. Prisma Schema & Multi-Tenant Architecture

### Prisma Client Extensions for Multi-Tenancy (D-04, D-05)

**Pattern:** Use `Prisma.defineExtension()` with `$allModels.$allOperations` to intercept every query and inject `tenantId` filtering.

```typescript
// packages/db/src/extensions/tenant.extension.ts
import { Prisma } from '@prisma/client';

export const tenantExtension = (tenantId: string) =>
  Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }) {
          // Skip tenant filtering for models without tenantId
          const modelsWithoutTenant = ['Tenant', 'AuditLog'];
          if (modelsWithoutTenant.includes(model)) return query(args);

          // SuperAdmin wildcard bypass (D-06)
          if (tenantId === '*') return query(args);

          // Inject tenantId into WHERE clauses
          if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            args.where = { ...args.where, tenantId };
          }
          if (['create', 'createMany'].includes(operation)) {
            args.data = { ...args.data, tenantId };
          }
          if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
            args.where = { ...args.where, tenantId };
          }

          return query(args);
        },
      },
    },
  });
```

**Key insight:** Use `AsyncLocalStorage` (via `nestjs-cls` package) to propagate `tenantId` from JWT to the Prisma extension without passing it through every service method.

**Pitfall — Unique constraints:** Soft-deleted records can conflict with `UNIQUE` constraints. Use PostgreSQL partial unique indexes:
```sql
CREATE UNIQUE INDEX idx_user_email_active ON "User"(email) WHERE "deletedAt" IS NULL;
```

### Soft Delete Extension (D-02)

**Pattern:** Override `delete` → `update(deletedAt)` and add `WHERE deletedAt IS NULL` to all reads.

```typescript
export const softDeleteExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async delete({ args, query, model }) {
        // Convert delete to soft delete
        return (prisma as any)[model].update({
          ...args,
          data: { deletedAt: new Date() },
        });
      },
    },
  },
});
```

**Consider:** The `prisma-extension-soft-delete` npm package handles nested relations and complex `where` clauses as a battle-tested alternative to a custom implementation.

### Schema File Organization (D-01)

**Decision:** Use a single `schema.prisma` file. Prisma's multi-file support (`prismaSchemaFolder`) is still a preview feature in Prisma 6.x and can cause migration issues with `prisma migrate`. A single file of ~2000 lines is manageable with good section comments.

### Enum Strategy (D-03 — Hybrid)

**Prisma native enums (stable values):**
- `AccountType`: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- `NotificationChannel`: IN_APP, EMAIL, SMS, WEBHOOK
- `WidgetType`: BAR_CHART, LINE_CHART, PIE_CHART, KPI_CARD, TABLE, HEATMAP, FUNNEL

**String fields with TypeScript enums (evolving statuses):**
- PO lifecycle: DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
- Leave states: DRAFT → PENDING → APPROVED/REJECTED → CANCELLED
- Invoice statuses, payroll run statuses

---

## 2. TimescaleDB Hypertables (DB-03)

### Setup Pattern

Prisma cannot define hypertables natively. Use Prisma's `--create-only` migration and add raw SQL:

```bash
npx prisma migrate dev --name add_hypertables --create-only
```

Then edit the generated `migration.sql`:

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert AuditLog to hypertable (partitioned by timestamp)
SELECT create_hypertable('"AuditLog"', 'timestamp');

-- Convert ForecastPrediction to hypertable (partitioned by forecastDate)
SELECT create_hypertable('"ForecastPrediction"', 'forecastDate');

-- Enable compression on AuditLog after 30 days
ALTER TABLE "AuditLog" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"tenantId"',
  timescaledb.compress_orderby = 'timestamp DESC'
);
SELECT add_compression_policy('"AuditLog"', INTERVAL '30 days');
```

**Critical constraint:** TimescaleDB requires that any `UNIQUE` or `PRIMARY KEY` constraint on a hypertable MUST include the partitioning column. This means:
- `AuditLog` must have a composite primary key: `@@id([id, timestamp])` or use `@id` on a UUID with `timestamp` as a separate required field
- Use `cuid()` or `uuid()` for IDs instead of `autoincrement()` on hypertables (autoincrement conflicts with partitioning)

---

## 3. Keycloak 25 Integration (D-07, D-08, D-09)

### Realm Auto-Import in Docker

**Keycloak 25+ uses `--import-realm` flag** (NOT the deprecated `KEYCLOAK_IMPORT` env var):

```yaml
# docker-compose.yml
keycloak:
  image: quay.io/keycloak/keycloak:25.0
  command: start-dev --import-realm
  volumes:
    - ./infra/keycloak/amdox-realm.json:/opt/keycloak/data/import/amdox-realm.json:ro
  environment:
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://timescaledb:5432/keycloak_db
    KC_DB_USERNAME: root
    KC_DB_PASSWORD: rootpassword
    KC_BOOTSTRAP_ADMIN_USERNAME: admin
    KC_BOOTSTRAP_ADMIN_PASSWORD: adminpassword
```

### Realm JSON Structure (Key Sections)

```json
{
  "realm": "amdox-erp",
  "enabled": true,
  "sslRequired": "none",
  "roles": {
    "realm": [
      { "name": "super_admin", "composite": false },
      { "name": "tenant_admin", "composite": false },
      { "name": "finance_manager", "composite": false },
      { "name": "hr_manager", "composite": false },
      { "name": "supply_chain_manager", "composite": false },
      { "name": "project_manager", "composite": false },
      { "name": "viewer", "composite": false }
    ]
  },
  "clients": [
    {
      "clientId": "amdox-web",
      "publicClient": true,
      "directAccessGrantsEnabled": true,
      "redirectUris": ["http://localhost:3000/*"],
      "webOrigins": ["http://localhost:3000"],
      "attributes": { "pkce.code.challenge.method": "S256" }
    },
    {
      "clientId": "amdox-api",
      "publicClient": false,
      "serviceAccountsEnabled": true,
      "secret": "changeme-in-production"
    }
  ],
  "passwordPolicy": "length(12) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1)",
  "bruteForceProtected": true,
  "maxFailureWaitSeconds": 1800,
  "failureFactor": 5,
  "protocolMappers": [
    {
      "name": "tenant_id_mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-usermodel-attribute-mapper",
      "config": {
        "user.attribute": "tenant_id",
        "claim.name": "tenant_id",
        "jsonType.label": "String",
        "id.token.claim": "true",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### Separate Keycloak Database (D-08)

Add an init script to TimescaleDB service to create the `keycloak_db` database:

```yaml
# docker-compose.yml
timescaledb:
  image: timescale/timescaledb:latest-pg17
  environment:
    POSTGRES_USER: root
    POSTGRES_PASSWORD: rootpassword
    POSTGRES_DB: amdox_erp
  volumes:
    - ./infra/db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

```sql
-- infra/db/init.sql
CREATE DATABASE keycloak_db;
```

---

## 4. NestJS Authentication Stack (AUTH-06 through AUTH-10)

### JWT Strategy with RS256 via JWKS

**Dependencies:** `@nestjs/passport`, `passport`, `passport-jwt`, `jwks-rsa`, `@nestjs/config`

```typescript
// apps/api/src/auth/strategies/jwt.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const keycloakUrl = configService.get('KEYCLOAK_URL');
    const realm = configService.get('KEYCLOAK_REALM');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: `${keycloakUrl}/realms/${realm}`,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
  }

  validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: payload.realm_access?.roles || [],
      tenantId: payload.tenant_id,
    };
  }
}
```

### RolesGuard Pattern (AUTH-07)

```typescript
// Custom decorator
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

### TenantGuard Pattern (AUTH-08)

Extracts `tenant_id` from JWT and injects into request context:

```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (!tenantId && !request.user?.roles?.includes('super_admin')) {
      throw new ForbiddenException('Tenant context required');
    }

    // Store tenantId in CLS (AsyncLocalStorage) for Prisma extension
    request.tenantId = tenantId || '*'; // SuperAdmin wildcard
    return true;
  }
}
```

### AuditInterceptor Pattern (AUTH-09, D-10, D-11)

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations (D-11)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Capture before-state for updates/deletes
    let beforeSnapshot = null;
    if (['PUT', 'PATCH', 'DELETE'].includes(method) && request.params.id) {
      beforeSnapshot = await this.getEntitySnapshot(request);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.prisma.auditLog.create({
          data: {
            action: method,
            entityType: this.getEntityType(request),
            entityId: request.params.id || response?.id,
            before: beforeSnapshot,       // Full JSON snapshot (D-10)
            after: response,              // Full JSON snapshot (D-10)
            userId: request.user?.userId,
            tenantId: request.user?.tenantId,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            timestamp: new Date(),
          },
        });
      }),
    );
  }
}
```

**Performance note:** For production, push audit writes to BullMQ queue instead of blocking the response. In Phase 2, synchronous writes are acceptable for correctness validation.

### Token Blacklist (AUTH-10)

Use Redis for token blacklist on logout/password change:

```typescript
// On logout: store JWT ID (jti) with TTL matching token expiry
await redis.setex(`blacklist:${jti}`, tokenTtlSeconds, 'revoked');

// In JwtStrategy.validate(): check blacklist before accepting
const isBlacklisted = await redis.get(`blacklist:${jti}`);
if (isBlacklisted) throw new UnauthorizedException('Token revoked');
```

---

## 5. NestJS Module Structure

### Recommended Module Layout

```
apps/api/src/
├── app.module.ts              # Root module
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── tenant.guard.ts
│   ├── interceptors/
│   │   └── audit.interceptor.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   └── filters/
│       └── http-exception.filter.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts       # Tenant-scoped client factory
└── health/
    └── health.controller.ts
```

### Key NestJS Dependencies

```json
{
  "@nestjs/common": "^11.0.0",
  "@nestjs/core": "^11.0.0",
  "@nestjs/config": "^4.0.0",
  "@nestjs/passport": "^11.0.0",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.0",
  "jwks-rsa": "^3.0.0",
  "@nestjs/terminus": "^11.0.0",
  "nestjs-cls": "^4.0.0",
  "ioredis": "^5.0.0",
  "@prisma/client": "^6.0.0",
  "prisma": "^6.0.0"
}
```

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hypertable PK constraint | Cannot use `autoincrement()` on hypertables | Use `cuid()` or `uuid()` for AuditLog and ForecastPrediction IDs |
| Prisma doesn't support RLS natively | Tenant bypass via raw queries | Extension covers all Prisma operations; raw queries must manually filter |
| Keycloak realm import is one-time-only | Changes after initial import are not re-imported | Use Admin API for runtime changes; realm JSON is bootstrap only |
| Soft delete + unique constraints | "Deleted" records block new ones | Use PostgreSQL partial unique indexes (`WHERE deletedAt IS NULL`) |
| 40+ models in one schema file | Hard to navigate | Use section headers and consistent ordering within sections |

## Validation Architecture

### Verification Strategy
1. `prisma migrate dev` applies cleanly with all models and hypertables
2. Tenant middleware test: query without tenantId throws error
3. Keycloak realm import creates all roles and clients
4. JWT validation accepts valid Keycloak tokens, rejects expired/invalid
5. AuditInterceptor creates log entries for POST/PUT/PATCH/DELETE
6. Token blacklist prevents use of revoked tokens

---

*Phase: 02-database-schema-authentication*
*Research completed: 2026-04-12*
