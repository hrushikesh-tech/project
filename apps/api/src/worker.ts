import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker.module";
import { APP_RUNTIME_MODES } from "./runtime/runtime-mode";

async function bootstrap() {
  process.env.APP_RUNTIME ??= APP_RUNTIME_MODES.worker;

  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  app.enableShutdownHooks();

  const logger = new Logger("WorkerBootstrap");
  logger.log("Worker runtime is ready for background jobs.");

  const shutdown = async (signal: string) => {
    logger.log(`Worker runtime shutting down after ${signal}.`);
    await app.close();
    process.exit(0);
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
}

void bootstrap();
