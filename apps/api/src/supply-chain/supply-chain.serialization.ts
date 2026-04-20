import { Prisma } from "@amdox/db";

export function serializeSupplyChainValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeSupplyChainValue(item)) as T;
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeSupplyChainValue(nestedValue),
      ]),
    ) as T;
  }

  return value;
}
