import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type { AuthSession } from '@ludoteca/shared';
// Constants come from the zod-free entry point: the barrel would drag the whole
// validation library into the browser bundle for the sake of two strings.
import { CSRF_HEADER } from '@ludoteca/shared/constants';
import { API_BASE } from './api.service';
import { AuthStore } from './auth.store';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Attaches the session cookies. Angular does not send credentials by default,
 * and the API's CORS policy only accepts them from our exact origin.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) return next(req);
  return next(req.clone({ withCredentials: true }));
};

/**
 * Double-submit CSRF.
 *
 * The pairing is: an httpOnly cookie holds the SECRET, and the server hands the
 * matching TOKEN to us in the /auth/status response body. We echo the token in
 * this header and the server verifies it against the secret it can read.
 *
 * So the token comes from the AuthStore, never from document.cookie — the
 * cookie holds the secret, and sending that instead simply fails verification
 * (and the secret is httpOnly precisely so no script can read it).
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE) || SAFE_METHODS.includes(req.method)) return next(req);

  const token = inject(AuthStore).csrfToken;
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { [CSRF_HEADER]: token } }));
};

/**
 * Transparent session refresh.
 *
 * The access token is deliberately short-lived, so a 401 mid-session is the
 * normal case, not an error. We rotate once and replay the original request;
 * the user never sees it.
 *
 * The single-flight guard matters: a dashboard fires several requests at once,
 * and without it each 401 would start its own rotation. Since rotation revokes
 * the token it replaces, the second one would look like a *stolen token being
 * reused* and nuke the whole session — logging the user out for doing nothing
 * wrong.
 */
let refreshInFlight: Promise<AuthSession | null> | null = null;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);

  if (!req.url.startsWith(API_BASE) || isAuthEndpoint(req.url)) return next(req);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }

      refreshInFlight ??= refreshSession(auth.csrfToken);

      return from(refreshInFlight).pipe(
        switchMap((session) => {
          refreshInFlight = null;
          if (!session) {
            auth.clear();
            return throwError(() => err);
          }
          auth.apply(session);
          // Replay with the rotated CSRF token; the cookies came along with it.
          const headers = SAFE_METHODS.includes(req.method)
            ? req.headers
            : req.headers.set(CSRF_HEADER, session.csrfToken);
          return next(req.clone({ headers, withCredentials: true }));
        }),
        catchError((refreshErr: unknown) => {
          refreshInFlight = null;
          auth.clear();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

/**
 * Deliberately plain fetch rather than HttpClient: routing it back through the
 * interceptor chain would let a failing refresh trigger another refresh.
 */
async function refreshSession(csrfToken: string): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: csrfToken },
    });
    if (!response.ok) return null;
    return (await response.json()) as AuthSession;
  } catch {
    return null;
  }
}

/** Auth endpoints must never be retried by the refresh logic. */
function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/status') ||
    url.includes('/auth/logout')
  );
}

export const httpInterceptors = [credentialsInterceptor, csrfInterceptor, refreshInterceptor];
