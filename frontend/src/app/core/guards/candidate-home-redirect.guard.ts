import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * The bare '' route still renders the placeholder ShellComponent (useful for
 * admin until Feature 6's admin routes land here). Candidates get a real home
 * screen instead - this guard redirects them to /tests without touching
 * anything admin-related.
 */
export const candidateHomeRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.session()?.role === 'candidate') {
    return router.createUrlTree(['/tests']);
  }
  return true;
};
