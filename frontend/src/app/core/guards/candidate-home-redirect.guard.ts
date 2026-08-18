import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * The bare '' route redirects signed-in users to their role's home screen:
 * candidates -> /tests, admins -> /admin. Anyone else (shouldn't happen once
 * authGuard has run) falls through to the placeholder ShellComponent.
 */
export const candidateHomeRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const role = authService.session()?.role;
  if (role === 'candidate') {
    return router.createUrlTree(['/tests']);
  }
  if (role === 'admin') {
    return router.createUrlTree(['/admin']);
  }
  return true;
};
