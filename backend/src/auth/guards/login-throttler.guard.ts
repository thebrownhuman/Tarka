import { Injectable, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/app-error-code';

/**
 * Keys rate-limit buckets by IP + login_id combo (per spec edge case 2), not IP alone -
 * otherwise a shared office/NAT IP would throttle every candidate off one bad actor,
 * and otherwise a single attacker could spray many login_ids from one IP unthrottled per-id.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const loginId = req.body?.login_id ?? 'unknown';
    return `${req.ip}:${loginId}`;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new AppException(AppErrorCode.RATE_LIMITED, 'Too many login attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
