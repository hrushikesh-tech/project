import assert from "node:assert/strict";

const baseUrl = process.env.PHASE15_SMOKE_BASE_URL?.trim();
const username =
  process.env.PHASE17_AUTH_USERNAME ??
  process.env.PHASE15_AUTH_USERNAME ??
  process.env.PHASE12_AUTH_USERNAME;
const password =
  process.env.PHASE17_AUTH_PASSWORD ??
  process.env.PHASE15_AUTH_PASSWORD ??
  process.env.PHASE12_AUTH_PASSWORD;
const tenantId = process.env.PHASE15_TENANT_ID?.trim() || "tenant-1";

if (!baseUrl) {
  throw new Error("Set PHASE15_SMOKE_BASE_URL to the deployed staging API URL before running this smoke.");
}

if (!username || !password) {
  throw new Error(
    "Phase 17 staging smoke requires PHASE17_AUTH_USERNAME/PHASE17_AUTH_PASSWORD or the existing Phase 15/12 auth credentials.",
  );
}

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  return { response, payload };
}

const health = await requestJson("/api/v1/health", { method: "GET" });
assert.equal(health.response.status, 200);
assert.equal(health.payload.data.status, "ok");

const login = await requestJson("/api/v1/auth/login", {
  method: "POST",
  body: JSON.stringify({
    username,
    password,
  }),
});
assert.equal(login.response.status, 201);
assert.ok(login.payload.data.access_token);
assert.ok(login.payload.data.refresh_token);

const me = await requestJson("/api/v1/auth/me", {
  method: "GET",
  headers: {
    authorization: `Bearer ${login.payload.data.access_token}`,
    "x-tenant-id": tenantId,
  },
});
assert.equal(me.response.status, 200);
assert.ok(me.payload.data.userId);

const logout = await requestJson("/api/v1/auth/logout", {
  method: "POST",
  headers: {
    authorization: `Bearer ${login.payload.data.access_token}`,
    "x-tenant-id": tenantId,
  },
  body: JSON.stringify({
    refresh_token: login.payload.data.refresh_token,
  }),
});
assert.equal(logout.response.status, 201);

const revokedToken = await requestJson("/api/v1/auth/me", {
  method: "GET",
  headers: {
    authorization: `Bearer ${login.payload.data.access_token}`,
    "x-tenant-id": tenantId,
  },
});
assert.equal(revokedToken.response.status, 401);
