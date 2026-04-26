import { createAparHarness } from './apar-test-store.mjs';
import { createFinanceHarness, seedFinanceHarness } from './finance-test-store.mjs';
import { createSupplyChainHarness, seedInventoryHarness } from './supply-chain-test-store.mjs';

function ensureCollection(state, key) {
  if (!Array.isArray(state[key])) {
    state[key] = [];
  }

  return state[key];
}

function ensureUserStore(harness) {
  const users = ensureCollection(harness.state, 'users');

  if (!harness.prisma.user) {
    harness.prisma.user = {
      async findMany({ where = {} } = {}) {
        return users.filter((user) =>
          Object.entries(where).every(([key, value]) => user[key] === value),
        );
      },
      async findFirst({ where = {} } = {}) {
        return users.find((user) =>
          Object.entries(where).every(([key, value]) => user[key] === value),
        ) ?? null;
      },
      async create({ data }) {
        users.push(data);
        return data;
      },
    };
  }

  return users;
}

function createHarness({ harnessType = 'apar', tenantId } = {}) {
  if (harnessType === 'finance') {
    return createFinanceHarness({ tenantId });
  }

  if (harnessType === 'supply-chain') {
    return createSupplyChainHarness({ tenantId });
  }

  return createAparHarness({ tenantId });
}

export function createTestTenant({ harness, harnessType = 'apar', tenantId = 'tenant-test-1' } = {}) {
  const resolvedHarness = harness ?? createHarness({ harnessType, tenantId });
  const tenants = ensureCollection(resolvedHarness.state, 'tenants');
  const existingTenant = tenants.find((item) => item.id === tenantId);

  if (!existingTenant) {
    tenants.push({ id: tenantId });
  }

  if (resolvedHarness.cls?.set) {
    resolvedHarness.cls.set('tenantId', tenantId);
  }

  return {
    tenant: existingTenant ?? { id: tenantId },
    harness: resolvedHarness,
  };
}

export function createTestUser({
  harness,
  tenantId = harness?.state?.tenants?.[0]?.id ?? 'tenant-test-1',
  userId = 'user-test-1',
  email = 'tester@amdox.dev',
  firstName = 'Test',
  lastName = 'User',
  role = 'tenant_admin',
  roles = [role],
  keycloakId = `kc-${userId}`,
} = {}) {
  const resolvedHarness = harness ?? createHarness({ tenantId });
  const { tenant } = createTestTenant({ harness: resolvedHarness, tenantId });

  if (typeof resolvedHarness.insertUser === 'function') {
    const user = resolvedHarness.insertUser({
      id: userId,
      tenantId: tenant.id,
      email,
      firstName,
      lastName,
      role,
      keycloakId,
    });
    return { harness: resolvedHarness, user: { ...user, roles } };
  }

  const users = ensureUserStore(resolvedHarness);
  const user = {
    id: userId,
    tenantId: tenant.id,
    email,
    firstName,
    lastName,
    role,
    roles,
    keycloakId,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  users.push(user);

  return {
    harness: resolvedHarness,
    user,
  };
}

export function cleanupTestTenant({ harness, tenantId } = {}) {
  if (!harness || !tenantId) {
    return { removed: 0 };
  }

  let removed = 0;
  for (const [key, value] of Object.entries(harness.state)) {
    if (!Array.isArray(value)) {
      continue;
    }

    const nextItems = value.filter((item) => item?.tenantId !== tenantId && item?.id !== tenantId);
    removed += value.length - nextItems.length;
    harness.state[key] = nextItems;
  }

  if (harness.cls?.get?.('tenantId') === tenantId) {
    harness.cls.set('tenantId', null);
  }

  return { removed };
}

export function mockKeycloak({
  tenantId = 'tenant-test-1',
  userId = 'user-test-1',
  email = 'tester@amdox.dev',
  roles = ['tenant_admin'],
  token = 'phase15-test-token',
} = {}) {
  const user = {
    sub: userId,
    userId,
    email,
    roles,
    tenantId,
  };

  return {
    token,
    user,
    headers: {
      authorization: `Bearer ${token}`,
      'x-user-id': userId,
      'x-roles': roles.join(','),
      'x-auth-tenant': tenantId,
      'x-tenant-id': tenantId,
    },
    attach(request) {
      return Object.entries(this.headers).reduce(
        (currentRequest, [key, value]) => currentRequest.set(key, value),
        request,
      );
    },
  };
}

export function seedFinanceData({ harness, tenantId = 'tenant-test-1', ...options } = {}) {
  const resolvedHarness = harness ?? createFinanceHarness({ tenantId });
  createTestTenant({ harness: resolvedHarness, harnessType: 'finance', tenantId });

  return {
    harness: resolvedHarness,
    ...seedFinanceHarness(resolvedHarness, options),
  };
}

export function seedInventoryData({ harness, tenantId = 'tenant-test-1', ...options } = {}) {
  const resolvedHarness = harness ?? createSupplyChainHarness({ tenantId });
  createTestTenant({ harness: resolvedHarness, harnessType: 'supply-chain', tenantId });

  return {
    harness: resolvedHarness,
    ...seedInventoryHarness(resolvedHarness, options),
  };
}
