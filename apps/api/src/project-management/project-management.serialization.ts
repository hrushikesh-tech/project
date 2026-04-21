import { Prisma } from "@amdox/db";

export function serializeProjectManagementValue<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeProjectManagementValue(entry)) as T;
  }

  if (value instanceof Date || value == null) {
    return value;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, nestedValue]) => [
          key,
          serializeProjectManagementValue(nestedValue),
        ],
      ),
    ) as T;
  }

  return value;
}
