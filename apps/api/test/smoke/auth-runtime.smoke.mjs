import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const apiPort = Number(process.env.PHASE15_SMOKE_API_PORT ?? 3101);
const baseUrl = process.env.PHASE15_SMOKE_BASE_URL ?? `http://127.0.0.1:${apiPort}`;
const username = process.env.PHASE15_AUTH_USERNAME ?? process.env.PHASE12_AUTH_USERNAME;
const password = process.env.PHASE15_AUTH_PASSWORD ?? process.env.PHASE12_AUTH_PASSWORD;
const tenantId = process.env.PHASE15_TENANT_ID ?? 'tenant-1';
const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
const builtEntryPoint = existsSync(fileURLToPath(new URL('../../dist/main.js', import.meta.url)))
  ? fileURLToPath(new URL('../../dist/main.js', import.meta.url))
  : fileURLToPath(new URL('../../dist/src/main.js', import.meta.url));

if (!username || !password) {
  throw new Error(
    'Phase 15 smoke requires PHASE15_AUTH_USERNAME/PHASE15_AUTH_PASSWORD or PHASE12_AUTH_USERNAME/PHASE12_AUTH_PASSWORD.',
  );
}

async function waitForHealthy(url, timeoutMs = 45000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the server is up or the timeout expires.
    }

    await delay(1000);
  }

  throw new Error(`API did not become healthy within ${timeoutMs}ms at ${url}.`);
}

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  return { response, payload };
}

const apiProcess = spawn(process.execPath, [builtEntryPoint], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT_API: String(apiPort),
  },
});

try {
  await waitForHealthy(baseUrl);

  const health = await requestJson('/api/v1/health', { method: 'GET' });
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.data.status, 'ok');

  const login = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
    }),
  });
  assert.equal(login.response.status, 201);
  assert.ok(login.payload.data.access_token);
  assert.ok(login.payload.data.refresh_token);

  const me = await requestJson('/api/v1/auth/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${login.payload.data.access_token}`,
      'x-tenant-id': tenantId,
    },
  });
  assert.equal(me.response.status, 200);
  assert.ok(me.payload.data.userId);

  const logout = await requestJson('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${login.payload.data.access_token}`,
      'x-tenant-id': tenantId,
    },
    body: JSON.stringify({
      refresh_token: login.payload.data.refresh_token,
    }),
  });
  assert.equal(logout.response.status, 201);

  const blacklistedToken = await requestJson('/api/v1/auth/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${login.payload.data.access_token}`,
      'x-tenant-id': tenantId,
    },
  });
  assert.equal(blacklistedToken.response.status, 401);
} finally {
  apiProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    apiProcess.once('exit', resolve);
    setTimeout(resolve, 5000);
  });
}
