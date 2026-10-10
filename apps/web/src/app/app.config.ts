import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { AuthStore } from './core/auth.store';
import { httpInterceptors } from './core/http.interceptors';
import { ThemeService } from './core/theme.service';
import { routes } from './app.routes';

function deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let s = snapshot;
  while (s.firstChild) s = s.firstChild;
  return s;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Restore the scroll position on back, and start at the top otherwise —
      // landing mid-page after a route change feels broken.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Native View Transitions between screens: the outgoing page fades, the
      // incoming one rises in, while the header and tab bar (named in the
      // shell) stay put. Browsers without support just swap instantly.
      withViewTransitions({
        skipInitialTransition: true,
        // Same screen, new query string (a search, a filter in the URL): the
        // content updates in place, so a full-page cross-fade would just blink.
        onViewTransitionCreated: ({ transition, from, to }) => {
          const a = deepest(from);
          const b = deepest(to);
          if (a.routeConfig === b.routeConfig && JSON.stringify(a.params) === JSON.stringify(b.params)) {
            transition.skipTransition();
          }
        },
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors(httpInterceptors)),
    provideAppInitializer(() => {
      // Resolve the theme before first paint so there's no white flash on a
      // dark-mode reload, and resolve the session so guards don't race it.
      inject(ThemeService);
      return inject(AuthStore).loadStatus();
    }),
  ],
};
