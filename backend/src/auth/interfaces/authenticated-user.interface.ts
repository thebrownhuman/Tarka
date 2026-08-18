import { UserRole } from '../../users/entities/user.entity';

/** Attached to `request.user` by JwtStrategy. Always re-fetched fresh from the DB
 * on every request so must_change_password / is_active reflect current state,
 * not a stale JWT claim from token-issue time. */
export interface AuthenticatedUser {
  id: string;
  loginId: string;
  role: UserRole;
  displayName: string;
  mustChangePassword: boolean;
}
