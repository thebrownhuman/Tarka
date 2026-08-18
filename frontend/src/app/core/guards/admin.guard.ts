import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * authGuard only checks that *someone* is signed in - it has no concept of
 * role. Without this, a candidate session can navigate straight to /admin/*
 * and see the full admin shell render (tabs, "Admin" badge, etc.) before
 * every API call gets rejected by the backend with 403, which reads as a
 * broken page rather than "you don't have access." Redirect candidates to
 * their own home instead.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.session()?.role === 'admin') {
    return true;
  }
  return router.createUrlTree(['/tests']);
};
