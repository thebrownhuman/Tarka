import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_WHEN_MUST_CHANGE_PASSWORD_KEY } from '../decorators/allow-when-must-change-password.decorator';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/app-error-code';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (user?.mustChangePassword && !allowed) {
      throw new AppException(
        AppErrorCode.MUST_CHANGE_PASSWORD,
        'You must change your password before accessing this resource.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
