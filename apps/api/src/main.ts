import cluster from "node:cluster";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApiDocs } from "./common/api/api-docs";
import { requestIdMiddleware } from "./common/api/request-id.middleware";
import { setupSecurityHeaders } from "./common/security/security-headers";
import { APP_RUNTIME_MODES } from "./runtime/runtime-mode";

function readClusterWorkers() {
  const configured = Number(process.env.CLUSTER_WORKERS ?? "1");
  if (Number.isFinite(configured) && configured > 1) {
    return Math.floor(configured);
  }

  return 1;
}

function readLoggerConfig() {
  return process.env.PERF_VALIDATION_MODE === "true"
    ? ["error", "warn"] as const
    : undefined;
}

async function bootstrap() {
  process.env.APP_RUNTIME ??= APP_RUNTIME_MODES.api;

  const app = await NestFactory.create(AppModule, {
    logger: readLoggerConfig(),
  });
  const configService = app.get(ConfigService);
  app.enableShutdownHooks();
  app.use(requestIdMiddleware);
  setupSecurityHeaders(app, configService);
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  setupApiDocs(app);

  const port = Number(process.env.PORT_API ?? process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`API is running on: http://localhost:${port}`);
}

async function main() {
  const workerCount = readClusterWorkers();

  if (workerCount <= 1 || cluster.isWorker) {
    await bootstrap();
    return;
  }

  cluster.schedulingPolicy = cluster.SCHED_RR;
  console.log(`Starting API cluster with ${workerCount} workers`);

  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork();
  }

  cluster.on("exit", () => {
    cluster.fork();
  });
}

void main();
