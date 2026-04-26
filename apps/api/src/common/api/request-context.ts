import { API_REQUEST_ID_HEADER } from "./request-id.constants";

export type ApiPaginationMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export type ApiMeta = {
  requestId: string;
  timestamp: string;
  pagination?: ApiPaginationMeta;
};

export type ApiSuccessResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorDescriptor = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  error: ApiErrorDescriptor;
  meta: ApiMeta;
};

type RequestLike = {
  requestId?: string;
  headers?: Record<string, string | string[] | undefined>;
};

function readHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

export function getRequestId(request?: RequestLike): string {
  const requestId = request?.requestId?.trim();
  if (requestId) {
    return requestId;
  }

  const headerValue = readHeaderValue(request?.headers?.[API_REQUEST_ID_HEADER]);
  if (headerValue?.trim()) {
    return headerValue.trim();
  }

  return "unknown";
}

export function buildApiMeta(
  request?: RequestLike,
  pagination?: ApiPaginationMeta,
): ApiMeta {
  return {
    requestId: getRequestId(request),
    timestamp: new Date().toISOString(),
    ...(pagination ? { pagination } : {}),
  };
}

export function isApiSuccessEnvelope(value: unknown): value is ApiSuccessResponse<unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "data" in value &&
      "meta" in value &&
      value.meta &&
      typeof value.meta === "object",
  );
}

export function toApiSuccessResponse<T>(
  data: T,
  request?: RequestLike,
  pagination?: ApiPaginationMeta,
): ApiSuccessResponse<T> {
  return {
    data,
    meta: buildApiMeta(request, pagination),
  };
}

export function writeApiErrorResponse(
  response: {
    status(code: number): { json(payload: ApiErrorResponse): unknown };
  },
  request: RequestLike | undefined,
  statusCode: number,
  error: ApiErrorDescriptor,
) {
  return response.status(statusCode).json({
    error,
    meta: buildApiMeta(request),
  });
}
