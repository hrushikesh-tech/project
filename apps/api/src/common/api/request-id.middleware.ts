import { randomUUID } from "node:crypto";
import type { NextFunction } from "express";
import { API_REQUEST_ID_HEADER } from "./request-id.constants";

type RequestWithRequestId = {
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseWithHeader = {
  setHeader(name: string, value: string): void;
};

function readHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

export function requestIdMiddleware(
  request: RequestWithRequestId,
  response: ResponseWithHeader,
  next: NextFunction,
) {
  const requestId =
    readHeaderValue(request.headers?.[API_REQUEST_ID_HEADER])?.trim() ||
    randomUUID();

  request.requestId = requestId;
  response.setHeader(API_REQUEST_ID_HEADER, requestId);
  next();
}
