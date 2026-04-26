import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ForbiddenException } = require('@nestjs/common');
const { JwtStrategy } = require('../../dist/src/auth/strategies/jwt.strategy.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');

test('jwt strategy preserves tenant scope for tenant admins', async () => {
  const strategy = new JwtStrategy(
    {
      get(key, fallback) {
        const values = {
          KEYCLOAK_URL: 'http://localhost:8080',
          KEYCLOAK_REALM: 'amdox-erp',
        };
        return values[key] ?? fallback;
      },
    },
    {
      async isTokenBlacklisted() {
        return false;
      },
    },
  );

  const user = await strategy.validate({
    sub: 'user-1',
    email: 'admin@amdox.dev',
    tenant_id: 'tenant-123',
    realm_access: { roles: ['admin'] },
  });

  assert.equal(user.tenantId, 'tenant-123');
});

test('tenant guard stores the concrete tenant id in CLS', () => {
  const writes = [];
  const guard = new TenantGuard(
    {
      set(key, value) {
        writes.push([key, value]);
      },
    },
    {
      getAllAndOverride() {
        return false;
      },
    },
  );

  const context = {
    getType() {
      return 'http';
    },
    getHandler() {
      return null;
    },
    getClass() {
      return null;
    },
    switchToHttp() {
      return {
        getRequest() {
          return {
            user: {
              tenantId: 'tenant-456',
              roles: ['admin'],
            },
          };
        },
      };
    },
  };

  assert.equal(guard.canActivate(context), true);
  assert.deepEqual(writes, [
    ['tenantId', 'tenant-456'],
    ['effectiveTenantId', 'tenant-456'],
    ['actingTenantOverride', false],
  ]);
});

test('tenant guard rejects authenticated requests without tenant context', () => {
  const guard = new TenantGuard(
    {
      set() {},
    },
    {
      getAllAndOverride() {
        return false;
      },
    },
  );

  const context = {
    getType() {
      return 'http';
    },
    getHandler() {
      return null;
    },
    getClass() {
      return null;
    },
    switchToHttp() {
      return {
        getRequest() {
          return {
            user: {
              roles: ['super_admin'],
            },
          };
        },
      };
    },
  };

  assert.throws(() => guard.canActivate(context), ForbiddenException);
});
