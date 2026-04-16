import { Prisma } from '@prisma/client';

// Models that do NOT have tenantId - skip tenant filtering for these
const SYSTEM_MODELS = ['Tenant', 'TaxSlab'];

// Read operations that need WHERE clause injection
const READ_OPERATIONS = [
  'findMany',
  'findFirst',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
];

// Write operations that need WHERE clause injection
const WRITE_OPERATIONS = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

// Create operations that need DATA injection
const CREATE_OPERATIONS = ['create', 'createMany', 'createManyAndReturn'];

/**
 * Creates a Prisma Client Extension that automatically injects tenantId
 * into every query for multi-tenant data isolation.
 *
 * @param tenantId - The tenant ID to scope queries to.
 *   - Pass a valid tenant ID for request-scoped queries.
 *   - If empty/undefined, the extension throws for non-system models.
 */
export const createTenantExtension = (tenantId: string) =>
  Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SYSTEM_MODELS.includes(model as string)) {
            return query(args);
          }

          if (!tenantId || tenantId === '*') {
            throw new Error(
              `Tenant context required - cannot execute ${operation} on ${model} without tenantId`,
            );
          }

          if (READ_OPERATIONS.includes(operation)) {
            (args as any).where = { ...(args as any).where, tenantId };
          }

          if (CREATE_OPERATIONS.includes(operation)) {
            if (operation === 'createMany' || operation === 'createManyAndReturn') {
              const data = (args as any).data;
              if (Array.isArray(data)) {
                (args as any).data = data.map((item: any) => ({
                  ...item,
                  tenantId,
                }));
              }
            } else {
              (args as any).data = { ...(args as any).data, tenantId };
            }
          }

          if (WRITE_OPERATIONS.includes(operation)) {
            (args as any).where = { ...(args as any).where, tenantId };
          }

          if (operation === 'upsert') {
            (args as any).create = { ...(args as any).create, tenantId };
          }

          return query(args);
        },
      },
    },
  });
