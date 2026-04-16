import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import {
  MissingFxRateException,
  PeriodClosedException,
  PostedEntryImmutableException,
  UnbalancedEntryException,
} from '@amdox/types';

@Catch(
  MissingFxRateException,
  PeriodClosedException,
  PostedEntryImmutableException,
  UnbalancedEntryException,
)
export class FinanceExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    let status = HttpStatus.BAD_REQUEST;
    if (exception instanceof PeriodClosedException) {
      status = HttpStatus.CONFLICT;
    }
    if (exception instanceof PostedEntryImmutableException) {
      status = HttpStatus.CONFLICT;
    }

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
