import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  DashboardAccessDenied,
  InvalidWidgetConfiguration,
  ReportScheduleExecutionFailed,
  UnsupportedMetricKey,
} from "@amdox/types";

@Catch(
  UnsupportedMetricKey,
  InvalidWidgetConfiguration,
  DashboardAccessDenied,
  ReportScheduleExecutionFailed,
)
export class BiExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof DashboardAccessDenied
        ? HttpStatus.FORBIDDEN
        : exception instanceof ReportScheduleExecutionFailed
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
