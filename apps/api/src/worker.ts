import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker.module";
import { APP_RUNTIME_MODES } from "./runtime/runtime-mode";
import { createTelemetryRuntime } from "./telemetry/bootstrap";

async function bootstrap() {
  process.env.APP_RUNTIME ??= APP_RUNTIME_MODES.worker;

  const telemetry = createTelemetryRuntime({
    serviceName:
      process.env.OTEL_SERVICE_NAME_WORKER ??
      process.env.OTEL_SERVICE_NAME ??
      "amdox-api-worker",
    runtime: APP_RUNTIME_MODES.worker,
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    metricsPath: process.env.METRICS_PATH ?? "/metrics",
    activeUserWindowMinutes: Number(
      process.env.TELEMETRY_ACTIVE_USER_WINDOW_MINUTES ?? "15",
    ),
  });
  const bootstrapSpan = telemetry.beginSpan("worker.bootstrap", {
    "service.name": telemetry.serviceName,
    "telemetry.runtime": telemetry.runtime,
  });
  const lifecycleSpan = telemetry.beginSpan("worker.runtime", {
    "service.name": telemetry.serviceName,
    "telemetry.runtime": telemetry.runtime,
  });

  const logger = new Logger("WorkerBootstrap");

  try {
    const app = await NestFactory.createApplicationContext(WorkerAppModule);
    app.enableShutdownHooks();
    bootstrapSpan.end("ok");
    logger.log("Worker runtime is ready for background jobs.");

    const shutdown = async (signal: string) => {
      logger.log(`Worker runtime shutting down after ${signal}.`);
      lifecycleSpan.end("ok", { signal });
      await app.close();
      process.exit(0);
    };

    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => {
        void shutdown(signal);
      });
    }
  } catch (error) {
    bootstrapSpan.end("error", {
      "error.message": error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

void bootstrap();
