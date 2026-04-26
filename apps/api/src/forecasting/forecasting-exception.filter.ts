import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  ActiveForecastModelNotFound,
  ForecastPromotionRejected,
  ForecastQualityGateFailed,
} from "@amdox/types";
import { writeApiErrorResponse } from "../common/api/request-context";

@Catch(
  ActiveForecastModelNotFound,
  ForecastPromotionRejected,
  ForecastQualityGateFailed,
)
export class ForecastingExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof ActiveForecastModelNotFound
        ? HttpStatus.NOT_FOUND
        : HttpStatus.CONFLICT;

    return writeApiErrorResponse(response, request, status, {
      code: exception.name,
      message: exception.message,
    });
  }
}
