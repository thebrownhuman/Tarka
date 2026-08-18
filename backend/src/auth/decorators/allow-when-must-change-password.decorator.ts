import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_MUST_CHANGE_PASSWORD_KEY = 'allowWhenMustChangePassword';
/** Marks a protected route as reachable even while the caller's must_change_password flag is true. */
export const AllowWhenMustChangePassword = () => SetMetadata(ALLOW_WHEN_MUST_CHANGE_PASSWORD_KEY, true);
