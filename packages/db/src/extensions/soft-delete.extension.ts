import { Prisma } from "@prisma/client";

// Read operations that need deletedAt filtering
const READ_OPERATIONS = [
  "findMany",
  "findFirst",
  "findUnique",
  "findFirstOrThrow",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
];

type QueryArgs = {
  where?: Record<string, unknown>;
};

type ModelMutationMethods = {
  update: (args: {
    where?: Record<string, unknown>;
    data: { deletedAt: Date };
  }) => unknown;
  updateMany: (args: {
    where?: Record<string, unknown>;
    data: { deletedAt: Date };
  }) => unknown;
};

type ModelContext = Record<string, ModelMutationMethods>;

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
        const queryArgs = (args ?? {}) as QueryArgs;

        // Handle opt-out mechanism: includeDeleted flag
        const where = queryArgs.where;
        if (where?.includeDeleted === true) {
          // Remove the flag and skip soft-delete filtering
          delete queryArgs.where?.includeDeleted;
          return query(queryArgs);
        }

        // Inject deletedAt: null filter for read operations
        if (READ_OPERATIONS.includes(operation)) {
          queryArgs.where = {
            ...queryArgs.where,
            deletedAt: null,
          };
        }

        // Convert delete to soft delete (update with deletedAt timestamp)
        if ((operation as string) === "delete") {
          const context = Prisma.getExtensionContext(this) as ModelContext;
          return context[model as string].update({
            where: queryArgs.where,
            data: { deletedAt: new Date() },
          });
        }

        if (operation === "deleteMany") {
          const context = Prisma.getExtensionContext(this) as ModelContext;
          return context[model as string].updateMany({
            where: queryArgs.where,
            data: { deletedAt: new Date() },
          });
        }

        return query(queryArgs);
      },
    },
  },
});
