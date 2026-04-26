type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  send(body: string): void;
};

type NextFunction = () => void;

function readHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

export function createApiDocsBasicAuthMiddleware(
  username: string,
  password: string,
) {
  return (request: RequestLike, response: ResponseLike, next: NextFunction) => {
    const header = readHeaderValue(request.headers?.authorization);
    if (!header?.startsWith("Basic ")) {
      response.setHeader("WWW-Authenticate", 'Basic realm="Amdox API Docs"');
      response.status(401).send("Authentication required");
      return;
    }

    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const providedUsername =
      separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
    const providedPassword =
      separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

    if (providedUsername !== username || providedPassword !== password) {
      response.setHeader("WWW-Authenticate", 'Basic realm="Amdox API Docs"');
      response.status(401).send("Invalid credentials");
      return;
    }

    next();
  };
}
