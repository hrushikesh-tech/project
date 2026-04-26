import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, "..", "..", "..", "..");
const decimalRequire = createRequire(
  join(
    workspaceRoot,
    "node_modules",
    ".pnpm",
    "decimal.js@10.6.0",
    "node_modules",
    "decimal.js",
    "package.json",
  ),
);

const Decimal = decimalRequire(".");

export function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }

  return new Decimal(String(value ?? 0));
}

export const Prisma = {
  Decimal,
};
