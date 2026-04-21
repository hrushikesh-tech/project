import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  CircularDependencyException,
  MilestoneTaskLinkException,
  ProjectManagerValidationException,
} from "@amdox/types";

@Catch(
  CircularDependencyException,
  ProjectManagerValidationException,
  MilestoneTaskLinkException,
)
export class ProjectManagementExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof CircularDependencyException
        ? HttpStatus.CONFLICT
        : exception instanceof BadRequestException
          ? HttpStatus.BAD_REQUEST
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
