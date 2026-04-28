import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SERVICE_PATHS = {
  web: "web.image.tag",
  api: "api.image.tag",
  apiWorker: "apiWorker.image.tag",
  mlService: "mlService.image.tag",
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (!token.startsWith("--")) {
      fail(`Unexpected argument: ${token}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`Missing value for ${token}`);
    }

    options[token.slice(2)] = value;
    index += 1;
  }

  return options;
}

function buildTagMap(options) {
  const sharedTag = options["set-tag"];
  const tags = {
    web: options["web-tag"] ?? sharedTag,
    api: options["api-tag"] ?? sharedTag,
    apiWorker: options["api-worker-tag"] ?? sharedTag,
    mlService: options["ml-service-tag"] ?? sharedTag,
  };

  const activeEntries = Object.entries(tags).filter(([, value]) => Boolean(value));
  if (activeEntries.length === 0) {
    fail(
      "Provide --set-tag or at least one of --web-tag, --api-tag, --api-worker-tag, or --ml-service-tag.",
    );
  }

  return Object.fromEntries(activeEntries);
}

function yamlKeyFromLine(trimmedLine) {
  if (!trimmedLine || trimmedLine.startsWith("#") || trimmedLine.startsWith("- ")) {
    return null;
  }

  const match = trimmedLine.match(/^([A-Za-z0-9_-]+):(?:\s|$)/);
  return match?.[1] ?? null;
}

function rewriteYaml(source, tagMap) {
  const lines = source.split(/\r?\n/);
  const stack = [];
  const seenPaths = new Set();
  const changes = [];

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    const key = yamlKeyFromLine(trimmed);

    if (!key) {
      return line;
    }

    const indent = line.length - line.trimStart().length;
    while (stack.length > 0 && indent <= stack.at(-1).indent) {
      stack.pop();
    }
    stack.push({ indent, key });

    const currentPath = stack.map((entry) => entry.key).join(".");
    const serviceName = Object.entries(SERVICE_PATHS).find(([, value]) => value === currentPath)?.[0];
    if (!serviceName || !(serviceName in tagMap)) {
      return line;
    }

    seenPaths.add(currentPath);
    const previousValue = trimmed.slice("tag:".length).trim();
    const nextValue = tagMap[serviceName];

    if (previousValue === nextValue) {
      return line;
    }

    changes.push({
      service: serviceName,
      path: currentPath,
      from: previousValue,
      to: nextValue,
    });

    return `${" ".repeat(indent)}tag: ${nextValue}`;
  });

  const missingPaths = Object.entries(tagMap)
    .map(([serviceName]) => SERVICE_PATHS[serviceName])
    .filter((servicePath) => !seenPaths.has(servicePath));

  if (missingPaths.length > 0) {
    fail(`Missing required image tag paths: ${missingPaths.join(", ")}`);
  }

  return {
    content: updatedLines.join("\n"),
    changes,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const file = options.file;
  if (!file) {
    fail("Missing required --file argument.");
  }

  const tagMap = buildTagMap(options);
  const targetFile = path.resolve(process.cwd(), file);
  const original = await readFile(targetFile, "utf8");
  const result = rewriteYaml(original, tagMap);

  if (result.changes.length === 0) {
    console.log(`No image tag changes required for ${file}.`);
  } else {
    console.log(`Image tag updates for ${file}:`);
    for (const change of result.changes) {
      console.log(`- ${change.path}: ${change.from} -> ${change.to}`);
    }
  }

  if (!options.dryRun) {
    await writeFile(targetFile, result.content);
  }
}

await main();
