import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  NotificationActorRequiredException,
  NotificationAdminAccessException,
} from "@amdox/types";

@Catch(NotificationActorRequiredException, NotificationAdminAccessException)
export class NotificationsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof NotificationAdminAccessException
        ? HttpStatus.FORBIDDEN
        : HttpStatus.UNAUTHORIZED;

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
