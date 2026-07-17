import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AuthSession, AuthStatus, LoginInput, Me, RegisterInput, UpdateProfileInput } from '@ludoteca/shared';
import { ApiService } from './api.service';

/**
 * The session, as the UI sees it.
 *
 * Note what is NOT here: tokens. They live in httpOnly cookies the browser
 * attaches for us and JavaScript cannot read — so there is nothing here for an
 * XSS payload to steal. The only thing we hold is the CSRF token, which is
 * useless on its own.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ApiService);

  private readonly _user = signal<Me | null>(null);
  private readonly _csrfToken = signal<string>('');
  private readonly _ready = signal(false);
  private readonly _googleEnabled = signal(false);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  /** False until the first /auth/status settles — guards wait on this. */
  readonly ready = this._ready.asReadonly();
  readonly googleEnabled = this._googleEnabled.asReadonly();

  get csrfToken(): string {
    return this._csrfToken();
  }

  /**
   * Called once at bootstrap. Also the only way to get a CSRF token, so it must
   * run before any mutating request — including login.
   */
  async loadStatus(): Promise<void> {
    try {
      const status = await firstValueFrom(this.api.get<AuthStatus>('/auth/status'));
      this._user.set(status.user);
      this._csrfToken.set(status.csrfToken);
      this._googleEnabled.set(status.features.googleOAuth);
    } catch {
      // A failed status check means "not signed in", not a broken app.
      this._user.set(null);
    } finally {
      this._ready.set(true);
    }
  }

  async login(input: LoginInput): Promise<void> {
    const session = await firstValueFrom(this.api.post<AuthSession>('/auth/login', input));
    this.apply(session);
  }

  async register(input: RegisterInput): Promise<void> {
    const session = await firstValueFrom(this.api.post<AuthSession>('/auth/register', input));
    this.apply(session);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout'));
    } finally {
      // Clear locally even if the call failed — the user asked to be signed out,
      // and the cookies are gone or expiring either way.
      this._user.set(null);
      await this.loadStatus();
    }
  }

  /** Used by the refresh interceptor after it rotates the session. */
  apply(session: AuthSession): void {
    this._user.set(session.user);
    this._csrfToken.set(session.csrfToken);
  }

  applyUser(user: Me): void {
    this._user.set(user);
  }

  async updateProfile(input: UpdateProfileInput): Promise<void> {
    const user = await firstValueFrom(this.api.patch<Me>('/me', input));
    this._user.set(user);
  }

  clear(): void {
    this._user.set(null);
  }
}
