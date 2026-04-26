import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RequestUser } from "../interfaces/request-user.interface";
import {
  getRateLimitPolicies,
  RATE_LIMIT_BUCKETS,
  type RateLimitBucket,
} from "./rate-limit.policy";
import { RATE_LIMIT_BUCKET_METADATA } from "./rate-limit.decorator";

type RateLimitedRequest = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: RequestUser;
};

type CounterRecord = {
  count: number;
  expiresAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly counters = new Map<string, CounterRecord>();
  private readonly rateLimitEnabled: boolean;

  constructor(private readonly reflector: Reflector) {
    this.rateLimitEnabled =
      String(process.env.SECURITY_RATE_LIMIT_ENABLED ?? "true").toLowerCase() !==
      "false";
  }

  canActivate(context: ExecutionContext) {
    if (!this.rateLimitEnabled) {
      return true;
    }

    if (context.getType() !== "http") {
      return true;
    }

    const bucket =
      this.reflector.getAllAndOverride<RateLimitBucket>(
        RATE_LIMIT_BUCKET_METADATA,
        [context.getHandler(), context.getClass()],
      ) ?? RATE_LIMIT_BUCKETS.DEFAULT;
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const policy = getRateLimitPolicies()[bucket];
    const identifiers = this.resolveIdentifiers(request, bucket);

    for (const identifier of identifiers) {
      const counterKey = `${bucket}:${identifier}`;
      const record = this.touchCounter(counterKey, policy.ttlMs);

      if (record.count > policy.limit) {
        throw new HttpException(
          `Rate limit exceeded for ${bucket}. Retry after the current window resets.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  private resolveIdentifiers(
    request: RateLimitedRequest,
    bucket: RateLimitBucket,
  ) {
    const ipAddress = this.readIpAddress(request);
    const identityKey =
      request.user?.userId &&
      `${request.user.effectiveTenantId ?? request.user.tenantId ?? "platform"}:${request.user.userId}`;

    const identifiers = [ipAddress];

    if (identityKey && bucket !== RATE_LIMIT_BUCKETS.AUTH) {
      identifiers.push(identityKey);
    }

    return identifiers;
  }

  private readIpAddress(request: RateLimitedRequest) {
    const forwardedFor = request.headers?.["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;
    const forwardedIp = forwardedValue?.split(",")[0]?.trim();

    return (
      forwardedIp ||
      request.ip ||
      request.socket?.remoteAddress ||
      "unknown"
    );
  }

  private touchCounter(key: string, ttlMs: number) {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.expiresAt <= now) {
      const next = { count: 1, expiresAt: now + ttlMs };
      this.counters.set(key, next);
      this.cleanup(now);
      return next;
    }

    existing.count += 1;
    return existing;
  }

  private cleanup(now: number) {
    for (const [key, record] of this.counters.entries()) {
      if (record.expiresAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
