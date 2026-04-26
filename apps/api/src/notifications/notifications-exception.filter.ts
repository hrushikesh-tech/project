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
import { writeApiErrorResponse } from "../common/api/request-context";

@Catch(NotificationActorRequiredException, NotificationAdminAccessException)
export class NotificationsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof NotificationAdminAccessException
        ? HttpStatus.FORBIDDEN
        : HttpStatus.UNAUTHORIZED;

    return writeApiErrorResponse(response, request, status, {
      code: exception.name,
      message: exception.message,
    });
  }
}
