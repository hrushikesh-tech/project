import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ForbiddenException } from '@nestjs/common';

const require = createRequire(import.meta.url);
const { JwtStrategy } = require('../../dist/src/auth/strategies/jwt.strategy.js');
const { TenantGuard } = require('../../dist/src/common/guards/tenant.guard.js');

test('jwt strategy preserves tenant-scoped admin claims', async () => {
  const strategy = new JwtStrategy(
    {
      get(_key, fallback) {
        return fallback;
      },
    },
    {
      async isTokenBlacklisted() {
        return false;
      },
    },
  );

  const result = await strategy.validate({
    sub: 'user-1',
    email: 'admin@amdox.dev',
    tenant_id: 'tenant-1',
    sid: 'kc-session-1',
    jti: 'token-jti-1',
    realm_access: { roles: ['admin'] },
  });

  assert.equal(result.tenantId, 'tenant-1');
  assert.equal(result.sessionId, 'kc-session-1');
  assert.equal(result.jti, 'token-jti-1');
  assert.deepEqual(result.roles, ['admin']);
});

test('tenant guard requires an explicit tenant override for super-admin requests', () => {
  const cls = {
    set() {},
  };
  const guard = new TenantGuard(cls, {
    getAllAndOverride() {
      return false;
    },
  });

  const context = {
    getType() {
      return 'http';
    },
    switchToHttp() {
      return {
        getRequest() {
          return {
            headers: {},
            user: {
              roles: ['super_admin'],
            },
          };
        },
      };
    },
    getHandler() {
      return null;
    },
    getClass() {
      return null;
    },
  };

  assert.throws(() => guard.canActivate(context), ForbiddenException);
});

test('tenant guard stores the explicit tenant override for super-admin requests', () => {
  let storedTenantId;
  let storedEffectiveTenantId;
  let storedActingTenantOverride;
  const cls = {
    set(key, value) {
      if (key === 'tenantId') {
        storedTenantId = value;
      }
      if (key === 'effectiveTenantId') {
        storedEffectiveTenantId = value;
      }
      if (key === 'actingTenantOverride') {
        storedActingTenantOverride = value;
      }
    },
  };
  const guard = new TenantGuard(cls, {
    getAllAndOverride() {
      return false;
    },
  });

  const context = {
    getType() {
      return 'http';
    },
    switchToHttp() {
      return {
        getRequest() {
          return {
            headers: {
              'x-tenant-id': 'tenant-2',
            },
            user: {
              roles: ['super_admin'],
            },
          };
        },
      };
    },
    getHandler() {
      return null;
    },
    getClass() {
      return null;
    },
  };

  assert.equal(guard.canActivate(context), true);
  assert.equal(storedTenantId, 'tenant-2');
  assert.equal(storedEffectiveTenantId, 'tenant-2');
  assert.equal(storedActingTenantOverride, true);
});
