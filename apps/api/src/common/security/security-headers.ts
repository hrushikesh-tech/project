import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import helmet from "helmet";

export function setupSecurityHeaders(
  app: INestApplication,
  configService: ConfigService,
) {
  const reportOnly =
    String(configService.get("SECURITY_CSP_REPORT_ONLY", "true")).toLowerCase() !==
    "false";
  const reportUri = configService.get<string>("SECURITY_CSP_REPORT_URI")?.trim();
  const hstsEnabled =
    String(configService.get("SECURITY_HSTS_ENABLED", "true")).toLowerCase() !==
    "false";

  const directives: Record<string, string[] | null> = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    imgSrc: ["'self'", "data:", "blob:"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'"],
    ...(reportUri ? { "report-uri": [reportUri] } : {}),
  };

  app.use(
    helmet({
      frameguard: { action: "deny" },
      noSniff: true,
      hsts: hstsEnabled
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
            preload: false,
          }
        : false,
      referrerPolicy: { policy: "no-referrer" },
      contentSecurityPolicy: {
        directives,
        reportOnly,
      },
    }),
  );
}
