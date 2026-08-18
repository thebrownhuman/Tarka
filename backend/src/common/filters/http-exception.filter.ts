import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppErrorCode } from '../errors/app-error-code';

function defaultCodeForStatus(status: number): AppErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return AppErrorCode.UNAUTHENTICATED;
    case HttpStatus.FORBIDDEN:
      return AppErrorCode.FORBIDDEN_ROLE;
    case HttpStatus.TOO_MANY_REQUESTS:
      return AppErrorCode.RATE_LIMITED;
    case HttpStatus.CONFLICT:
      return AppErrorCode.LOGIN_ID_TAKEN;
    case HttpStatus.BAD_REQUEST:
      return AppErrorCode.VALIDATION_ERROR;
    case HttpStatus.NOT_FOUND:
      return AppErrorCode.USER_NOT_FOUND;
    default:
      return AppErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Catches every thrown error and normalizes it to `{ error: { code, message, status } }`
 * so the frontend has one shape to parse regardless of which layer threw.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = AppErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
        code = defaultCodeForStatus(status);
      } else if (typeof body === 'object' && body !== null) {
        const bodyRecord = body as Record<string, unknown>;
        const rawMessage = bodyRecord.message;
        message = Array.isArray(rawMessage) ? rawMessage.join(', ') : ((rawMessage as string) ?? message);
        code = (bodyRecord.code as string) ?? defaultCodeForStatus(status);
      }
    } else {
      // Unknown/unexpected error - never leak internals, but log for debugging.
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({ error: { code, message, status } });
  }
}
