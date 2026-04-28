import { randomBytes } from "node:crypto";
import {
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { Observable, tap } from "rxjs";
import {
  recordActiveUser,
  recordForecastMape,
  recordInvoiceProcessed,
  recordPayrollRunDuration,
  recordRuntimeRequestDuration,
  renderPrometheusMetrics,
} from "./metrics";

type TelemetryRuntimeOptions = {
  serviceName: string;
  runtime: "api" | "worker" | string;
  otlpEndpoint?: string;
  metricsPath?: string;
  activeUserWindowMinutes?: number;
};

type SpanState = {
  name: string;
  traceId: string;
  spanId: string;
  startTimeNs: bigint;
  attributes: Record<string, string | number | boolean>;
  ended: boolean;
};

type RuntimeSample = {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  durationSeconds: number;
  statusCode: number;
  responseBody: unknown;
};

type HttpResponseLike = Record<string, unknown> & {
  statusCode?: number;
  status(code: number): void;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

type HttpServerLike = {
  get(
    path: string,
    handler: (_request: unknown, response: HttpResponseLike) => void,
  ): void;
};

type HttpAppLike = {
  getHttpAdapter(): { getInstance(): unknown };
};

type TelemetrySpan = {
  end: (
    status?: "ok" | "error",
    extraAttributes?: Record<string, string | number | boolean>,
  ) => void;
  readonly ended: boolean;
};

function normalizeOtlpEndpoint(endpoint?: string) {
  const value = endpoint?.trim();
  if (!value) {
    return undefined;
  }

  if (value.includes("/v1/traces")) {
    return value;
  }

  return `${value.replace(/\/+$/, "")}/v1/traces`;
}

function sanitizeHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return sanitizeHeaderValue(value[0]);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function classifyInvoiceRoute(pathname: string) {
  if (pathname.includes("/invoices/upload")) {
    return "ap-ar.invoices.upload";
  }
  if (pathname.includes("/match")) {
    return "ap-ar.invoices.match";
  }
  if (pathname.includes("/review")) {
    return "ap-ar.invoices.review";
  }
  return "ap-ar.invoices";
}

function isPayrollRunRoute(pathname: string) {
  return pathname.includes("/payroll/runs") && !pathname.includes("/results");
}

function isForecastPredictRoute(pathname: string) {
  return (
    pathname.includes("/forecasting/products/") && pathname.endsWith("/predict")
  );
}

function toPathname(request: Record<string, unknown>) {
  const rawPath = sanitizeHeaderValue(request.originalUrl ?? request.url ?? "");
  if (!rawPath) {
    return "/";
  }
  const [pathname] = rawPath.split("?");
  return pathname || "/";
}

function toRouteName(request: Record<string, unknown>) {
  const routePath = sanitizeHeaderValue(request.route?.path);
  const baseUrl = sanitizeHeaderValue(request.baseUrl) ?? "";
  if (routePath) {
    return `${baseUrl}${routePath}` || routePath;
  }
  return toPathname(request);
}

function toTenantId(request: Record<string, unknown>) {
  return (
    sanitizeHeaderValue(request.user?.effectiveTenantId) ??
    sanitizeHeaderValue(request.user?.tenantId) ??
    sanitizeHeaderValue(request.headers?.["x-tenant-id"]) ??
    "platform"
  );
}

function toUserId(request: Record<string, unknown>) {
  return (
    sanitizeHeaderValue(request.user?.userId) ??
    sanitizeHeaderValue(request.user?.sub) ??
    sanitizeHeaderValue(request.headers?.["x-user-id"])
  );
}

function serializeAttributes(
  attributes: Record<string, string | number | boolean>,
) {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value:
      typeof value === "number"
        ? { doubleValue: value }
        : typeof value === "boolean"
          ? { boolValue: value }
          : { stringValue: value },
  }));
}

class RuntimeTelemetryInterceptor implements NestInterceptor {
  constructor(private readonly runtime: TelemetryRuntime) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const response = context.switchToHttp().getResponse<HttpResponseLike>();
    const method = sanitizeHeaderValue(request.method) ?? "GET";
    const route = toRouteName(request);
    const pathname = toPathname(request);
    const startedAt = performance.now();
    const requestId =
      sanitizeHeaderValue(request.requestId) ??
      sanitizeHeaderValue(request.headers?.["x-request-id"]) ??
      "unknown";
    const tenantId = toTenantId(request);
    const userId = toUserId(request);
    const span = this.runtime.beginSpan(`http ${method} ${route}`, {
      "http.method": method,
      "http.route": route,
      "http.path": pathname,
      "request.id": requestId,
      "telemetry.runtime": this.runtime.runtime,
      "service.name": this.runtime.serviceName,
      tenant_id: tenantId,
      ...(userId ? { user_id: userId } : {}),
    });

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const durationSeconds = (performance.now() - startedAt) / 1000;
          const statusCode =
            typeof response?.statusCode === "number"
              ? response.statusCode
              : 200;
          const sample: RuntimeSample = {
            request,
            response,
            durationSeconds,
            statusCode,
            responseBody,
          };

          this.runtime.recordHttpSample(sample, tenantId, userId);
          span.end("ok", {
            "http.status_code": statusCode,
            "request.duration_seconds": durationSeconds,
          });
        },
        error: (error: Error) => {
          const durationSeconds = (performance.now() - startedAt) / 1000;
          const statusCode =
            typeof response?.statusCode === "number"
              ? response.statusCode
              : 500;
          this.runtime.recordHttpSample(
            {
              request,
              response,
              durationSeconds,
              statusCode,
              responseBody: undefined,
            },
            tenantId,
            userId,
          );
          span.end("error", {
            "http.status_code": statusCode,
            "request.duration_seconds": durationSeconds,
            "error.message": error.message,
          });
        },
      }),
    );
  }
}

export class TelemetryRuntime {
  private readonly logger = new Logger(TelemetryRuntime.name);
  readonly runtime: string;
  readonly serviceName: string;
  readonly metricsPath: string;
  readonly activeUserWindowMinutes: number;

  constructor(private readonly options: TelemetryRuntimeOptions) {
    this.runtime = options.runtime;
    this.serviceName = options.serviceName;
    this.metricsPath = options.metricsPath ?? "/metrics";
    this.otlpTracesEndpoint = normalizeOtlpEndpoint(options.otlpEndpoint);
    this.activeUserWindowMinutes = options.activeUserWindowMinutes ?? 15;
  }

  private readonly otlpTracesEndpoint?: string;

  mountMetricsEndpoint(app: HttpAppLike) {
    const server = app.getHttpAdapter().getInstance() as
      | HttpServerLike
      | undefined;
    if (typeof server?.get !== "function") {
      return;
    }

    server.get(
      this.metricsPath,
      (_request: unknown, response: HttpResponseLike) => {
        response.status(200);
        response.setHeader(
          "content-type",
          "text/plain; version=0.0.4; charset=utf-8",
        );
        response.send(renderPrometheusMetrics());
      },
    );
  }

  createInterceptor() {
    return new RuntimeTelemetryInterceptor(this);
  }

  beginSpan(
    name: string,
    attributes: Record<string, string | number | boolean> = {},
  ): TelemetrySpan {
    const span: SpanState = {
      name,
      traceId: randomBytes(16).toString("hex"),
      spanId: randomBytes(8).toString("hex"),
      startTimeNs: process.hrtime.bigint(),
      attributes,
      ended: false,
    };

    return {
      get ended() {
        return span.ended;
      },
      end: (
        status: "ok" | "error" = "ok",
        extraAttributes: Record<string, string | number | boolean> = {},
      ) => {
        if (span.ended) {
          return;
        }
        span.ended = true;
        void this.exportSpan({
          ...span,
          endTimeNs: process.hrtime.bigint(),
          status,
          attributes: { ...span.attributes, ...extraAttributes },
        });
      },
    };
  }

  recordHttpSample(sample: RuntimeSample, tenantId: string, userId?: string) {
    const pathname = toPathname(sample.request);
    const outcome = sample.statusCode >= 400 ? "error" : "success";
    recordRuntimeRequestDuration({
      runtime: this.runtime,
      method: sanitizeHeaderValue(sample.request.method) ?? "GET",
      route: toRouteName(sample.request),
      outcome,
      durationSeconds: sample.durationSeconds,
    });

    if (userId) {
      recordActiveUser({
        tenantId,
        userId,
        windowMinutes: this.activeUserWindowMinutes,
      });
    }

    if (sample.statusCode >= 400) {
      return;
    }

    if (
      pathname.includes("/ap-ar/invoices") &&
      (sample.request.method === "POST" || sample.request.method === "PATCH")
    ) {
      recordInvoiceProcessed({
        tenantId,
        route: classifyInvoiceRoute(pathname),
      });
    }

    if (isPayrollRunRoute(pathname) && sample.request.method === "POST") {
      recordPayrollRunDuration({
        tenantId,
        route: "payroll.runs",
        durationSeconds: sample.durationSeconds,
      });
    }

    if (isForecastPredictRoute(pathname)) {
      const body = sample.responseBody as Record<string, unknown> | undefined;
      const mape =
        body && typeof body.mape === "number" ? body.mape : undefined;
      const productId =
        sanitizeHeaderValue(sample.request.params?.productId) ??
        sanitizeHeaderValue(body?.productId) ??
        "unknown";
      const modelType =
        sanitizeHeaderValue(body?.modelType) ??
        sanitizeHeaderValue(sample.request.body?.modelType) ??
        "unknown";

      if (mape !== undefined) {
        recordForecastMape({
          tenantId,
          productId,
          modelType,
          mapePercent: mape,
        });
      }
    }
  }

  private async exportSpan(
    span: SpanState & {
      endTimeNs: bigint;
      status: "ok" | "error";
    },
  ) {
    if (!this.otlpTracesEndpoint) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
      await fetch(this.otlpTracesEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: serializeAttributes({
                  "service.name": this.serviceName,
                  "telemetry.runtime": this.runtime,
                }),
              },
              scopeSpans: [
                {
                  scope: {
                    name: "amdox.telemetry",
                    version: "18-01",
                  },
                  spans: [
                    {
                      traceId: span.traceId,
                      spanId: span.spanId,
                      name: span.name,
                      kind: 1,
                      startTimeUnixNano: span.startTimeNs.toString(),
                      endTimeUnixNano: span.endTimeNs.toString(),
                      attributes: serializeAttributes(span.attributes),
                      status: {
                        code: span.status === "error" ? 2 : 1,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.debug(
        `Telemetry span export skipped for ${this.serviceName}: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createTelemetryRuntime(options: TelemetryRuntimeOptions) {
  return new TelemetryRuntime(options);
}
