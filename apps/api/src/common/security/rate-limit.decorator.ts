import { SetMetadata } from "@nestjs/common";
import type { RateLimitBucket } from "./rate-limit.policy";

export const RATE_LIMIT_BUCKET_METADATA = "security:rate-limit-bucket";

export const RateLimit = (bucket: RateLimitBucket) =>
  SetMetadata(RATE_LIMIT_BUCKET_METADATA, bucket);
