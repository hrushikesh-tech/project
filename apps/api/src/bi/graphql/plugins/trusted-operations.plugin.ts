import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

type TrustedOperationRecord =
  | string
  | {
      name?: string;
      query: string;
    };

type RequestLike = {
  body?: {
    query?: string;
    extensions?: {
      persistedQuery?: {
        sha256Hash?: string;
      };
    };
  };
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(payload: unknown): void;
};

type NextFunction = () => void;

function shouldEnforceTrustedOperations() {
  const isProduction = (process.env.NODE_ENV ?? "development") === "production";
  if (!isProduction) {
    return process.env.GRAPHQL_ENFORCE_TRUSTED_OPERATIONS === "true";
  }
  return process.env.GRAPHQL_ENFORCE_TRUSTED_OPERATIONS !== "false";
}

function normalizeQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

function extractQuery(record: TrustedOperationRecord) {
  return typeof record === "string" ? record : record.query;
}

function loadManifest(manifestPath: string) {
  const raw = readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as Record<string, TrustedOperationRecord>;
}

export function createTrustedOperationsMiddleware(manifestPath: string) {
  return (request: RequestLike, response: ResponseLike, next: NextFunction) => {
    if (!shouldEnforceTrustedOperations()) {
      next();
      return;
    }

    const hash = request.body?.extensions?.persistedQuery?.sha256Hash;
    if (!hash) {
      response.status(400).json({
        errors: [{ message: "Trusted operation hash required in production." }],
      });
      return;
    }

    const manifest = loadManifest(manifestPath);
    const trustedOperation = manifest[hash];
    if (!trustedOperation) {
      response.status(400).json({
        errors: [{ message: "Unknown trusted operation." }],
      });
      return;
    }

    const trustedQuery = extractQuery(trustedOperation);
    const providedQuery = request.body?.query;
    if (providedQuery) {
      const calculatedHash = createHash("sha256")
        .update(normalizeQuery(providedQuery))
        .digest("hex");

      if (calculatedHash !== hash || normalizeQuery(providedQuery) !== normalizeQuery(trustedQuery)) {
        response.status(400).json({
          errors: [{ message: "Provided query does not match the trusted manifest." }],
        });
        return;
      }
    }

    if (request.body) {
      request.body.query = trustedQuery;
    }

    next();
  };
}
