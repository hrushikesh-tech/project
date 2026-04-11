import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from './extensions/tenant.extension';
import { softDeleteExtension } from './extensions/soft-delete.extension';

/**
 * Creates a base PrismaClient instance with connection logging.
 * Use this for module initialization; wrap with extensions for request-scoped queries.
 */
export function createPrismaClient() {
  return new PrismaClient({
    log: ['warn', 'error'],
  });
}

/**
 * Creates a tenant-scoped Prisma client with soft-delete and tenant isolation.
 * This is the primary client factory for request-scoped database access.
 *
 * @param basePrisma - The base PrismaClient instance (from createPrismaClient)
 * @param tenantId - The tenant ID from the JWT claim
 * @returns Extended PrismaClient with soft-delete and tenant filtering
 */
export function createTenantClient(basePrisma: PrismaClient, tenantId: string) {
  return basePrisma
    .$extends(softDeleteExtension)
    .$extends(createTenantExtension(tenantId));
}
