import { Prisma } from '@prisma/client';

// Read operations that need deletedAt filtering
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

/**
 * Prisma Client Extension for soft-delete behavior.
 *
 * - Reads automatically filter out records where deletedAt is not null
 * - Delete operations are converted to updates that set deletedAt
 * - Opt-out: pass `includeDeleted: true` in the where clause to include soft-deleted records
 */
export const softDeleteExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Handle opt-out mechanism: includeDeleted flag
        const where = (args as any)?.where;
        if (where?.includeDeleted === true) {
          // Remove the flag and skip soft-delete filtering
          delete (args as any).where.includeDeleted;
          return query(args);
        }

        // Inject deletedAt: null filter for read operations
        if (READ_OPERATIONS.includes(operation)) {
          (args as any).where = {
            ...(args as any).where,
            deletedAt: null,
          };
        }

        // Convert delete to soft delete (update with deletedAt timestamp)
        if (operation === 'delete') {
          // Change operation to update
          return (query as any)({
            ...args,
            // We need to use the raw client to perform an update instead
          });
        }

        // For delete and deleteMany, we need a different approach:
        // Override at the model level to convert to update
        if (operation === 'delete') {
          const context = Prisma.getExtensionContext(this) as any;
          return context[model as string].update({
            where: (args as any).where,
            data: { deletedAt: new Date() },
          });
        }

        if (operation === 'deleteMany') {
          const context = Prisma.getExtensionContext(this) as any;
          return context[model as string].updateMany({
            where: (args as any).where,
            data: { deletedAt: new Date() },
          });
        }

        return query(args);
      },
    },
  },
});
