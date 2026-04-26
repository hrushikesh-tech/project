import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { VersioningType } = require("@nestjs/common");
const {
  ApiSuccessInterceptor,
} = require("../../dist/src/common/api/api-success.interceptor.js");
const {
  requestIdMiddleware,
} = require("../../dist/src/common/api/request-id.middleware.js");

export async function configureApiPlatform(app) {
  app.use(requestIdMiddleware);
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });
  app.useGlobalInterceptors(new ApiSuccessInterceptor());
  await app.init();
  return app;
}

export function unwrapBody(response) {
  return response.body?.data ?? response.body;
}

export function getMeta(response) {
  return response.body?.meta;
}
