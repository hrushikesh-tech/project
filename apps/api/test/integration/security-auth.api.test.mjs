import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ForbiddenException, UnauthorizedException } = require("@nestjs/common");
const { AuthService } = require("../../dist/src/auth/auth.service.js");

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildJwt(payload) {
  return `${encodeBase64Url({ alg: "RS256", typ: "JWT" })}.${encodeBase64Url(payload)}.signature`;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionDelegate(initialSessions = []) {
  const state = {
    sessions: initialSessions.map((session, index) => ({
      id: session.id ?? `session-${index + 1}`,
      createdAt: session.createdAt ?? new Date(),
      updatedAt: session.updatedAt ?? new Date(),
      ...session,
    })),
  };

  const delegate = {
    async count({ where }) {
      return state.sessions.filter((session) => matchesWhere(session, where)).length;
    },
    async findFirst({ where }) {
      return state.sessions.find((session) => matchesWhere(session, where)) ?? null;
    },
    async create({ data }) {
      const session = {
        id: data.id ?? `session-${state.sessions.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      state.sessions.push(session);
      return session;
    },
    async update({ where, data }) {
      const session = state.sessions.find((item) => matchesWhere(item, where));
      if (!session) {
        throw new Error("Session not found");
      }
      Object.assign(session, data, { updatedAt: new Date() });
      return session;
    },
    async updateMany({ where, data }) {
      const matches = state.sessions.filter((item) => matchesWhere(item, where));
      for (const session of matches) {
        Object.assign(session, data, { updatedAt: new Date() });
      }
      return { count: matches.length };
    },
  };

  return { state, delegate };
}

function matchesWhere(session, where) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "lte" in value) {
      return new Date(session[key]) <= value.lte;
    }

    return session[key] === value;
  });
}

function createConfig(overrides = {}) {
  const values = {
    KEYCLOAK_URL: "http://localhost:8080",
    KEYCLOAK_REALM: "amdox-erp",
    KEYCLOAK_CLIENT_ID: "amdox-api",
    KEYCLOAK_CLIENT_SECRET: "phase14-secret",
    AUTH_MAX_CONCURRENT_SESSIONS: 5,
    AUTH_REFRESH_SESSION_TTL_HOURS: 8,
    ...overrides,
  };

  return {
    get(key, fallback) {
      return values[key] ?? fallback;
    },
  };
}

function createAuthService(initialSessions = [], configOverrides = {}) {
  const { state, delegate } = createSessionDelegate(initialSessions);
  const prisma = { raw: { userSession: delegate } };
  const service = new AuthService(createConfig(configOverrides), prisma);
  return { service, state };
}

test("security auth rejects refresh-token replay and revokes the session row", async (t) => {
  const replayedRefreshToken = buildJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    sid: "kc-session-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const { service, state } = createAuthService([
    {
      tenantId: "tenant-1",
      userId: "user-1",
      keycloakSessionId: "kc-session-1",
      refreshTokenHash: hashToken("different-refresh-token"),
      status: "ACTIVE",
      issuedAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      deletedAt: null,
      revokedAt: null,
      revocationReason: null,
    },
  ]);

  await assert.rejects(
    () => service.refresh(replayedRefreshToken),
    UnauthorizedException,
  );
  assert.equal(state.sessions[0].revocationReason, "refresh_token_replay");
  assert.equal(state.sessions[0].status, "REVOKED");

  t.after(() => {
    delete global.fetch;
  });
});

test("security auth blocks a 6th concurrent session instead of evicting an older one", async (t) => {
  const loginAccessToken = buildJwt({
    sub: "user-1",
    email: "admin@amdox.dev",
    tenant_id: "tenant-1",
    sid: "kc-session-6",
    jti: "access-jti-6",
    exp: Math.floor(Date.now() / 1000) + 900,
  });
  const loginRefreshToken = buildJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    sid: "kc-session-6",
    exp: Math.floor(Date.now() / 1000) + 28_800,
    iat: Math.floor(Date.now() / 1000),
  });
  const { service, state } = createAuthService(
    Array.from({ length: 5 }, (_, index) => ({
      tenantId: "tenant-1",
      userId: "user-1",
      keycloakSessionId: `kc-session-${index + 1}`,
      refreshTokenHash: hashToken(`refresh-${index + 1}`),
      status: "ACTIVE",
      issuedAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      deletedAt: null,
      revokedAt: null,
      revocationReason: null,
    })),
  );

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes("/logout")) {
      return { ok: true, text: async () => "" };
    }

    return {
      ok: true,
      json: async () => ({
        access_token: loginAccessToken,
        refresh_token: loginRefreshToken,
        expires_in: 900,
        refresh_expires_in: 28_800,
        session_state: "kc-session-6",
      }),
    };
  };

  await assert.rejects(
    () => service.login("admin@amdox.dev", "Finance@123456"),
    ForbiddenException,
  );
  assert.equal(state.sessions.length, 5);

  t.after(() => {
    global.fetch = originalFetch;
  });
});
