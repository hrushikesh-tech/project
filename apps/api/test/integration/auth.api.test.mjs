import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { configureApiPlatform, getMeta, unwrapBody } from '../helpers/app-platform.mjs';
import { mockKeycloak } from '../helpers/test-fixtures.mjs';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AuthController } = require('../../dist/src/auth/auth.controller.js');
const { AuthService } = require('../../dist/src/auth/auth.service.js');
const { JwtAuthGuard } = require('../../dist/src/common/guards/jwt-auth.guard.js');

const originalCanActivate = JwtAuthGuard.prototype.canActivate;

async function createApp() {
  const authContext = mockKeycloak({
    userId: 'auth-user',
    email: 'auth@amdox.dev',
    tenantId: 'tenant-1',
    roles: ['tenant_admin'],
  });
  const calls = {
    login: 0,
    refresh: 0,
    logout: 0,
  };
  const authServiceMock = {
    async login(username, password) {
      calls.login += 1;
      return {
        access_token: `access:${username}:${password}`,
        refresh_token: 'refresh-token',
      };
    },
    async refresh(refreshToken) {
      calls.refresh += 1;
      return {
        access_token: `refreshed:${refreshToken}`,
        refresh_token: 'refresh-token-2',
      };
    },
    async logout(accessToken, refreshToken) {
      calls.logout += 1;
      return { accessToken, refreshToken };
    },
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authServiceMock },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use((req, _res, next) => {
    req.user = authContext.user;
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  await configureApiPlatform(app);
  return { app, authServiceMock, calls };
}

test('auth api exposes login, refresh, logout, me, and verify-mfa contracts', async () => {
  const authContext = mockKeycloak({
    userId: 'auth-user',
    email: 'auth@amdox.dev',
    tenantId: 'tenant-1',
    roles: ['tenant_admin'],
  });
  JwtAuthGuard.prototype.canActivate = function canActivate(context) {
    const request = context.switchToHttp().getRequest();
    request.user = authContext.user;
    return true;
  };

  try {
    const { app, calls } = await createApp();
    const api = request(app.getHttpServer());

    const invalidLogin = await api.post('/api/v1/auth/login').send({
      username: '',
      password: '',
    });
    assert.equal(invalidLogin.status, 400);
    assert.equal(calls.login, 0);

    const login = await api.post('/api/v1/auth/login').send({
      username: 'admin@amdox.dev',
      password: 'Finance@123456',
    });
    assert.equal(login.status, 201);
    assert.equal(
      unwrapBody(login).access_token,
      'access:admin@amdox.dev:Finance@123456',
    );
    assert.ok(getMeta(login)?.requestId);
    assert.equal(calls.login, 1);

    const invalidRefresh = await api.post('/api/v1/auth/refresh').send({
      refresh_token: '',
    });
    assert.equal(invalidRefresh.status, 400);
    assert.equal(calls.refresh, 0);

    const refresh = await api.post('/api/v1/auth/refresh').send({
      refresh_token: 'refresh-token',
    });
    assert.equal(refresh.status, 201);
    assert.equal(unwrapBody(refresh).access_token, 'refreshed:refresh-token');
    assert.ok(getMeta(refresh)?.requestId);
    assert.equal(calls.refresh, 1);

    const logout = await api
      .post('/api/v1/auth/logout')
      .set('authorization', 'Bearer sample-access-token')
      .send({
        refresh_token: 'refresh-token',
    });
    assert.equal(logout.status, 201);
    assert.equal(unwrapBody(logout).message, 'Logged out successfully');
    assert.equal(calls.logout, 1);

    const me = await api
      .get('/api/v1/auth/me')
      .set('authorization', 'Bearer sample-access-token');
    assert.equal(me.status, 200);
    assert.equal(unwrapBody(me).userId, 'auth-user');
    assert.equal(unwrapBody(me).tenantId, 'tenant-1');

    const verifyMfa = await api.post('/api/v1/auth/verify-mfa').send({
      session: 'mfa-session',
      otp: '123456',
    });
    assert.equal(verifyMfa.status, 201);
    assert.match(unwrapBody(verifyMfa).message, /Keycloak/i);

    const invalidMfa = await api.post('/api/v1/auth/verify-mfa').send({
      session: 'mfa-session',
      otp: '12345',
    });
    assert.equal(invalidMfa.status, 400);

    await app.close();
  } finally {
    JwtAuthGuard.prototype.canActivate = originalCanActivate;
  }
});
