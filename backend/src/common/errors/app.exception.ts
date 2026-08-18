import { HttpException, HttpStatus } from '@nestjs/common';
import { AppErrorCode } from './app-error-code';

/**
 * Uniform application exception. Always carries a stable machine-readable
 * `code` alongside the human message, so the frontend can branch on
 * behavior (e.g. MUST_CHANGE_PASSWORD) without parsing message text.
 */
export class AppException extends HttpException {
  constructor(code: AppErrorCode, message: string, status: HttpStatus) {
    super({ code, message }, status);
  }
}
