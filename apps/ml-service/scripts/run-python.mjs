import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const candidates = [
  path.join(rootDir, ".venv", "Scripts", "python.exe"),
  path.join(rootDir, ".venv", "bin", "python"),
  "python",
];

const python = candidates.find((candidate) =>
  candidate === "python" ? true : existsSync(candidate),
);

if (!python) {
  console.error("No Python interpreter available for apps/ml-service.");
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), {
  cwd: rootDir,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);

