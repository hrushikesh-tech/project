import http from "node:http";
import { URL } from "node:url";

const port = Number(process.env.PORT ?? 3001);
const keycloakUrl = process.env.KEYCLOAK_URL ?? "http://localhost:8081";
const realm = process.env.KEYCLOAK_REALM ?? "amdox-erp";
const clientId = process.env.KEYCLOAK_CLIENT_ID ?? "amdox-api";
const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

const tokenEndpoint = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
const logoutEndpoint = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout`;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  });
  res.end(JSON.stringify(payload));
}

function decodeJwt(token) {
  const [, payload] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function exchangeToken(params) {
  if (!clientSecret) {
    throw new Error("KEYCLOAK_CLIENT_SECRET must be configured before the auth proxy can exchange tokens.");
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...params,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "Keycloak token request failed");
  }

  return JSON.parse(text);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://127.0.0.1:${port}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (!clientSecret && pathname.startsWith("/api/v1/auth/")) {
      sendJson(res, 500, {
        message: "KEYCLOAK_CLIENT_SECRET must be configured before the auth proxy can serve auth requests.",
      });
      return;
    }

    if (pathname === "/api/v1/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (pathname === "/api/v1/auth/login" && req.method === "POST") {
      const body = await readJson(req);
      const tokens = await exchangeToken({
        grant_type: "password",
        username: body.username,
        password: body.password,
      });
      sendJson(res, 200, tokens);
      return;
    }

    if (pathname === "/api/v1/auth/refresh" && req.method === "POST") {
      const body = await readJson(req);
      const tokens = await exchangeToken({
        grant_type: "refresh_token",
        refresh_token: body.refresh_token,
      });
      sendJson(res, 200, tokens);
      return;
    }

    if (pathname === "/api/v1/auth/logout" && req.method === "POST") {
      const body = await readJson(req);
      await fetch(logoutEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: body.refresh_token ?? "",
        }),
      }).catch(() => {});

      sendJson(res, 200, { message: "Logged out successfully" });
      return;
    }

    if (pathname === "/api/v1/auth/me" && req.method === "GET") {
      const authHeader = req.headers.authorization ?? "";
      const accessToken = authHeader.replace(/^Bearer\s+/i, "");

      if (!accessToken) {
        sendJson(res, 401, { message: "Missing bearer token" });
        return;
      }

      const payload = decodeJwt(accessToken);
      const tenantClaim = Array.isArray(payload.tenant_id) ? payload.tenant_id[0] : payload.tenant_id;

      sendJson(res, 200, {
        userId: payload.sub,
        email: payload.email,
        roles: Array.isArray(payload.realm_access?.roles) ? payload.realm_access.roles : [],
        tenantId: typeof tenantClaim === "string" ? tenantClaim : undefined,
      });
      return;
    }

    sendJson(res, 404, { message: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      message: error instanceof Error ? error.message : "Unknown auth proxy failure",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Phase 12 auth proxy listening on http://localhost:${port}`);
});
