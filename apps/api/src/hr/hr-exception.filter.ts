import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  AttendanceCorrectionException,
  DepartmentHeadValidationException,
  EmployeeLifecycleException,
  InsufficientLeaveBalanceException,
  InvalidLeaveTransitionException,
} from "@amdox/types";

@Catch(
  AttendanceCorrectionException,
  DepartmentHeadValidationException,
  EmployeeLifecycleException,
  InsufficientLeaveBalanceException,
  InvalidLeaveTransitionException,
)
export class HrExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    response.status(HttpStatus.CONFLICT).json({
      statusCode: HttpStatus.CONFLICT,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
