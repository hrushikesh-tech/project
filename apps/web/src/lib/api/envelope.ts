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

export type ApiEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export function unwrapApiEnvelope<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "meta" in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

export function parseApiError(
  payload: string | ApiErrorEnvelope | null,
  status: number,
  fallbackMessage: string,
) {
  if (payload && typeof payload === "object" && "error" in payload) {
    return new ApiRequestError(
      payload.error.message || fallbackMessage,
      status,
      payload.error.code,
      payload.meta?.requestId,
      payload.error.details,
    );
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return new ApiRequestError(payload, status);
  }

  return new ApiRequestError(fallbackMessage, status);
}
