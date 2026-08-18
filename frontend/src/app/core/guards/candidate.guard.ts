import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Mirror of adminGuard: an admin session landing on a candidate-only route
 * (/tests, /take-test, /history) would otherwise render the candidate shell
 * and then have every API call rejected with 403 - redirect to /admin instead. */
export const candidateGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.session()?.role === 'candidate') {
    return true;
  }
  return router.createUrlTree(['/admin']);
};
