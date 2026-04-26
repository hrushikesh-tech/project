export const RATE_LIMIT_BUCKETS = {
  DEFAULT: "default",
  AUTH: "auth",
  OCR: "ocr",
  PAYROLL: "payroll",
} as const;

export type RateLimitBucket =
  (typeof RATE_LIMIT_BUCKETS)[keyof typeof RATE_LIMIT_BUCKETS];

export type RateLimitPolicy = {
  bucket: RateLimitBucket;
  limit: number;
  ttlMs: number;
};

function readNumericEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRateLimitPolicies() {
  return {
    [RATE_LIMIT_BUCKETS.DEFAULT]: {
      bucket: RATE_LIMIT_BUCKETS.DEFAULT,
      limit: readNumericEnv("SECURITY_GLOBAL_RPM", 100),
      ttlMs: 60_000,
    },
    [RATE_LIMIT_BUCKETS.AUTH]: {
      bucket: RATE_LIMIT_BUCKETS.AUTH,
      limit: readNumericEnv("SECURITY_AUTH_RPM", 10),
      ttlMs: 60_000,
    },
    [RATE_LIMIT_BUCKETS.OCR]: {
      bucket: RATE_LIMIT_BUCKETS.OCR,
      limit: readNumericEnv("SECURITY_OCR_RPM", 5),
      ttlMs: 60_000,
    },
    [RATE_LIMIT_BUCKETS.PAYROLL]: {
      bucket: RATE_LIMIT_BUCKETS.PAYROLL,
      limit: readNumericEnv("SECURITY_PAYROLL_RPH", 1),
      ttlMs: 60 * 60 * 1000,
    },
  } satisfies Record<RateLimitBucket, RateLimitPolicy>;
}
