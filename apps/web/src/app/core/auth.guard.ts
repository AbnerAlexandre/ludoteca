import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * These guards are a routing convenience, not a security boundary. The server
 * re-checks authentication and ownership on every request — a user who edits
 * their way past a guard reaches an API that says no.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.ready()) await auth.loadStatus();
  if (auth.isAuthenticated()) return true;

  // Remember where they were headed so login can send them back.
  return router.createUrlTree(['/entrar'], { queryParams: { next: state.url } });
};

/** Keeps a signed-in user off the login/register screens. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.ready()) await auth.loadStatus();
  return auth.isAuthenticated() ? router.createUrlTree(['/colecao']) : true;
};
