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
import { writeApiErrorResponse } from "../common/api/request-context";

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

    return writeApiErrorResponse(response, request, HttpStatus.CONFLICT, {
      code: exception.name,
      message: exception.message,
    });
  }
}
