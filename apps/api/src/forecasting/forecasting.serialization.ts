import { Prisma } from "@amdox/db";

function serializeForecastValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeForecastValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        serializeForecastValue(nested),
      ]),
    );
  }
  return value;
}

export function serializeForecastRecord<T>(record: T): T {
  return serializeForecastValue(record) as T;
}
