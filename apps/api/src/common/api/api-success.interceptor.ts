import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import { extractPagination } from "./api-pagination";
import {
  isApiSuccessEnvelope,
  toApiSuccessResponse,
} from "./request-context";

type RequestLike = {
  path?: string;
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

@Injectable()
export class ApiSuccessInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const accept = readHeaderValue(request.headers?.accept) ?? "";
    if (
      accept.includes("text/event-stream") ||
      request.path?.startsWith("/graphql")
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((value) => {
        if (isApiSuccessEnvelope(value)) {
          return value;
        }

        return toApiSuccessResponse(value, request, extractPagination(value));
      }),
    );
  }
}
