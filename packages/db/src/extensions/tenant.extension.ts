import { Prisma } from "@prisma/client";

// Models that do NOT have tenantId - skip tenant filtering for these
const SYSTEM_MODELS = ["Tenant", "TaxSlab"];

// Read operations that need WHERE clause injection
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

// Write operations that need WHERE clause injection
const WRITE_OPERATIONS = [
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
];

// Create operations that need DATA injection
const CREATE_OPERATIONS = ["create", "createMany", "createManyAndReturn"];

type TenantRecord = Record<string, unknown>;

type QueryArgs = {
  where?: TenantRecord;
  data?: TenantRecord | TenantRecord[];
  create?: TenantRecord;
};

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
          const queryArgs = (args ?? {}) as QueryArgs;

          if (SYSTEM_MODELS.includes(model as string)) {
            return query(queryArgs);
          }

          if (!tenantId || tenantId === "*") {
            throw new Error(
              `Tenant context required - cannot execute ${operation} on ${model} without tenantId`,
            );
          }

          if (READ_OPERATIONS.includes(operation)) {
            queryArgs.where = { ...queryArgs.where, tenantId };
          }

          if (CREATE_OPERATIONS.includes(operation)) {
            if (
              operation === "createMany" ||
              operation === "createManyAndReturn"
            ) {
              const data = queryArgs.data;
              if (Array.isArray(data)) {
                queryArgs.data = data.map((item) => ({
                  ...item,
                  tenantId,
                }));
              }
            } else {
              queryArgs.data = {
                ...(queryArgs.data as TenantRecord | undefined),
                tenantId,
              };
            }
          }

          if (WRITE_OPERATIONS.includes(operation)) {
            queryArgs.where = { ...queryArgs.where, tenantId };
          }

          if (operation === "upsert") {
            queryArgs.create = { ...queryArgs.create, tenantId };
          }

          return query(queryArgs);
        },
      },
    },
  });
