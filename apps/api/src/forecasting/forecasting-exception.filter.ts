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

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
