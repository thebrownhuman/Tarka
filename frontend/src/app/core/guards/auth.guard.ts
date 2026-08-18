import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes: no session (and no stored token to restore one from) ->
 * /login. Session present but must_change_password -> forced to
 * /change-password until that's resolved, no matter what route was requested.
 */
export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const existingSession = authService.session();
  if (existingSession) {
    return guardWithSession(existingSession.mustChangePassword, route.routeConfig?.path, router);
  }

  if (!authService.getAccessToken()) {
    return router.createUrlTree(['/login']);
  }

  // Access token exists in storage but the in-memory session was lost
  // (e.g. page reload) - restore it before deciding.
  return authService.fetchMe().pipe(
    map((session) => guardWithSession(session.mustChangePassword, route.routeConfig?.path, router)),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

function guardWithSession(mustChangePassword: boolean, requestedPath: string | undefined, router: Router): boolean | UrlTree {
  if (mustChangePassword && requestedPath !== 'change-password') {
    return router.createUrlTree(['/change-password']);
  }
  return true;
}
