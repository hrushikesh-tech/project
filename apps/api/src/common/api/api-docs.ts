import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { createApiDocsBasicAuthMiddleware } from "./api-docs-basic-auth.middleware";

function isProductionEnvironment() {
  return (process.env.NODE_ENV ?? "development") === "production";
}

function shouldEnableApiDocs() {
  if (!isProductionEnvironment()) {
    return process.env.API_DOCS_ENABLED !== "false";
  }

  return process.env.API_DOCS_ENABLED === "true";
}

function shouldProtectApiDocs() {
  return isProductionEnvironment() && process.env.API_DOCS_PROTECT !== "false";
}

export function setupApiDocs(app: INestApplication) {
  if (!shouldEnableApiDocs()) {
    return;
  }

  if (shouldProtectApiDocs()) {
    const username = process.env.API_DOCS_USERNAME ?? "amdox";
    const password = process.env.API_DOCS_PASSWORD ?? "amdox";
    const middleware = createApiDocsBasicAuthMiddleware(username, password);
    app.use("/api-docs", middleware);
    app.use("/api-docs-json", middleware);
  }

  const config = new DocumentBuilder()
    .setTitle("Amdox ERP API")
    .setDescription(
      "Standardized REST and BI GraphQL platform for the Amdox ERP suite.",
    )
    .setVersion("v1")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.openapi = "3.1.0";

  SwaggerModule.setup("api-docs", app, document, {
    jsonDocumentUrl: "api-docs-json",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
