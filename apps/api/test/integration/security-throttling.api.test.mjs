import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const request = require("supertest");
const { Controller, Get, Post } = require("@nestjs/common");
const { Test } = require("@nestjs/testing");
const { APP_GUARD } = require("@nestjs/core");
const {
  RateLimit,
} = require("../../dist/src/common/security/rate-limit.decorator.js");
const {
  RATE_LIMIT_BUCKETS,
} = require("../../dist/src/common/security/rate-limit.policy.js");
const {
  RateLimitGuard,
} = require("../../dist/src/common/security/rate-limit.guard.js");

class SecurityThrottleController {
  defaultRoute() {
    return { ok: true, bucket: "default" };
  }

  authRoute() {
    return { ok: true, bucket: "auth" };
  }

  ocrRoute() {
    return { ok: true, bucket: "ocr" };
  }

  payrollRoute() {
    return { ok: true, bucket: "payroll" };
  }
}

Controller({ path: "security-throttle", version: "1" })(SecurityThrottleController);
Get("default")(SecurityThrottleController.prototype, "defaultRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "defaultRoute"));
Post("auth")(SecurityThrottleController.prototype, "authRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "authRoute"));
Post("ocr")(SecurityThrottleController.prototype, "ocrRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "ocrRoute"));
Post("payroll")(SecurityThrottleController.prototype, "payrollRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "payrollRoute"));
RateLimit(RATE_LIMIT_BUCKETS.AUTH)(SecurityThrottleController.prototype, "authRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "authRoute"));
RateLimit(RATE_LIMIT_BUCKETS.OCR)(SecurityThrottleController.prototype, "ocrRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "ocrRoute"));
RateLimit(RATE_LIMIT_BUCKETS.PAYROLL)(SecurityThrottleController.prototype, "payrollRoute", Object.getOwnPropertyDescriptor(SecurityThrottleController.prototype, "payrollRoute"));

async function createApp() {
  process.env.SECURITY_GLOBAL_RPM = "2";
  process.env.SECURITY_AUTH_RPM = "2";
  process.env.SECURITY_OCR_RPM = "1";
  process.env.SECURITY_PAYROLL_RPH = "1";

  const moduleRef = await Test.createTestingModule({
    controllers: [SecurityThrottleController],
    providers: [
      RateLimitGuard,
      { provide: APP_GUARD, useClass: RateLimitGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  await app.init();
  return app;
}

test("security throttling enforces default, auth, OCR, and payroll 429 boundaries", async (t) => {
  const app = await createApp();
  const api = request(app.getHttpServer());

  const defaultOne = await api.get("/api/security-throttle/default");
  const defaultTwo = await api.get("/api/security-throttle/default");
  const defaultThree = await api.get("/api/security-throttle/default");
  assert.equal(defaultOne.status, 200);
  assert.equal(defaultTwo.status, 200);
  assert.equal(defaultThree.status, 429);

  const authOne = await api.post("/api/security-throttle/auth");
  const authTwo = await api.post("/api/security-throttle/auth");
  const authThree = await api.post("/api/security-throttle/auth");
  assert.equal(authOne.status, 201);
  assert.equal(authTwo.status, 201);
  assert.equal(authThree.status, 429);

  const ocrOne = await api.post("/api/security-throttle/ocr");
  const ocrTwo = await api.post("/api/security-throttle/ocr");
  assert.equal(ocrOne.status, 201);
  assert.equal(ocrTwo.status, 429);

  const payrollOne = await api.post("/api/security-throttle/payroll");
  const payrollTwo = await api.post("/api/security-throttle/payroll");
  assert.equal(payrollOne.status, 201);
  assert.equal(payrollTwo.status, 429);

  t.after(async () => {
    delete process.env.SECURITY_GLOBAL_RPM;
    delete process.env.SECURITY_AUTH_RPM;
    delete process.env.SECURITY_OCR_RPM;
    delete process.env.SECURITY_PAYROLL_RPH;
    await app.close();
  });
});
