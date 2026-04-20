import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AuthController } = require('../../dist/src/auth/auth.controller.js');
const { AuthService } = require('../../dist/src/auth/auth.service.js');
const { JwtAuthGuard } = require('../../dist/src/common/guards/jwt-auth.guard.js');

const originalCanActivate = JwtAuthGuard.prototype.canActivate;

async function createApp() {
  const authServiceMock = {
    async login(username, password) {
      return {
        access_token: `access:${username}:${password}`,
        refresh_token: 'refresh-token',
      };
    },
    async refresh(refreshToken) {
      return {
        access_token: `refreshed:${refreshToken}`,
        refresh_token: 'refresh-token-2',
      };
    },
    async logout(accessToken, refreshToken) {
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
    req.user = {
      userId: 'auth-user',
      email: 'auth@amdox.dev',
      roles: ['tenant_admin'],
      tenantId: 'tenant-1',
    };
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  await app.init();
  return { app, authServiceMock };
}

test('auth api exposes login, refresh, logout, me, and verify-mfa contracts', async () => {
  JwtAuthGuard.prototype.canActivate = function canActivate(context) {
    const request = context.switchToHttp().getRequest();
    request.user = {
      userId: 'auth-user',
      email: 'auth@amdox.dev',
      roles: ['tenant_admin'],
      tenantId: 'tenant-1',
    };
    return true;
  };

  try {
    const { app } = await createApp();
    const api = request(app.getHttpServer());

    const login = await api.post('/api/v1/auth/login').send({
      username: 'admin@amdox.dev',
      password: 'Finance@123456',
    });
    assert.equal(login.status, 201);
    assert.equal(login.body.access_token, 'access:admin@amdox.dev:Finance@123456');

    const refresh = await api.post('/api/v1/auth/refresh').send({
      refresh_token: 'refresh-token',
    });
    assert.equal(refresh.status, 201);
    assert.equal(refresh.body.access_token, 'refreshed:refresh-token');

    const logout = await api
      .post('/api/v1/auth/logout')
      .set('authorization', 'Bearer sample-access-token')
      .send({
        refresh_token: 'refresh-token',
      });
    assert.equal(logout.status, 201);
    assert.equal(logout.body.message, 'Logged out successfully');

    const me = await api
      .get('/api/v1/auth/me')
      .set('authorization', 'Bearer sample-access-token');
    assert.equal(me.status, 200);
    assert.equal(me.body.userId, 'auth-user');
    assert.equal(me.body.tenantId, 'tenant-1');

    const verifyMfa = await api.post('/api/v1/auth/verify-mfa').send({
      session: 'mfa-session',
      otp: '123456',
    });
    assert.equal(verifyMfa.status, 201);
    assert.match(verifyMfa.body.message, /Keycloak/i);

    await app.close();
  } finally {
    JwtAuthGuard.prototype.canActivate = originalCanActivate;
  }
});
