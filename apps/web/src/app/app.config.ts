import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { AuthStore } from './core/auth.store';
import { httpInterceptors } from './core/http.interceptors';
import { ThemeService } from './core/theme.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Restore the scroll position on back, and start at the top otherwise —
      // landing mid-page after a route change feels broken.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
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
