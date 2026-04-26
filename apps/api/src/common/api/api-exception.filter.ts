import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { writeApiErrorResponse } from "./request-context";

type HttpErrorPayload = {
  error?: string;
  message?: string | string[];
  details?: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== "http") {
      throw exception;
    }

    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const descriptor = this.buildDescriptor(exception);

    return writeApiErrorResponse(response, request, statusCode, descriptor);
  }

  private buildDescriptor(exception: unknown) {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === "string") {
        return {
          code: exception.name,
          message: payload,
        };
      }

      const objectPayload = payload as HttpErrorPayload;
      if (Array.isArray(objectPayload?.message)) {
        return {
          code: objectPayload.error ?? exception.name,
          message: "Validation failed",
          details: objectPayload.message,
        };
      }

      return {
        code: objectPayload?.error ?? exception.name,
        message: objectPayload?.message ?? exception.message,
        details: objectPayload?.details,
      };
    }

    if (exception instanceof Error) {
      return {
        code: exception.name || "InternalServerError",
        message: exception.message || "Unexpected server error",
      };
    }

    return {
      code: "InternalServerError",
      message: "Unexpected server error",
    };
  }
}
