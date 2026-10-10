import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LIMITS } from '@ludoteca/shared/constants';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'lt-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  template: `
    <lt-auth-layout
      eyebrow="Bem-vindo de volta"
      title="Sua estante, em qualquer mesa."
      subtitle="Entre para ver sua coleção, seus grupos e o que está emprestado."
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-5">
        <div>
          <label class="label" for="identifier">Login ou e-mail</label>
          <input
            id="identifier"
            type="text"
            class="field"
            formControlName="identifier"
            autocomplete="username"
            [class.field-invalid]="invalid('identifier')"
            [attr.aria-invalid]="invalid('identifier')"
            [attr.aria-describedby]="invalid('identifier') ? 'identifier-error' : null"
          />
          @if (invalid('identifier')) {
            <p id="identifier-error" class="error-text mt-1">Informe seu login ou e-mail.</p>
          }
        </div>

        <div>
          <div class="flex items-baseline justify-between">
            <label class="label" for="password">Senha</label>
            <button type="button" class="text-xs font-semibold text-ink-3 hover:text-ink" (click)="showPassword.set(!showPassword())" [attr.aria-pressed]="showPassword()">
              {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          <input
            id="password"
            [type]="showPassword() ? 'text' : 'password'"
            class="field"
            formControlName="password"
            autocomplete="current-password"
            [class.field-invalid]="invalid('password')"
            [attr.aria-invalid]="invalid('password')"
          />
          @if (invalid('password')) {
            <p class="error-text mt-1">Informe sua senha.</p>
          }
        </div>

        <!-- role=alert so a screen reader announces the failure without a focus jump. -->
        @if (error(); as e) {
          <p role="alert" class="notice notice-danger">{{ e }}</p>
        }

        <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="busy()">
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>

        @if (auth.googleEnabled()) {
          <a href="/api/auth/google" class="btn btn-ghost btn-lg w-full">Entrar com Google</a>
        }
      </form>

      <p class="mt-7 text-sm text-ink-3">
        Ainda não tem conta?
        <a routerLink="/criar-conta" class="link">Criar conta</a>
      </p>
    </lt-auth-layout>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStore);

  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(LIMITS.password.max)]],
  });

  protected invalid(name: 'identifier' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.form.getRawValue());
      // Return them to wherever the guard interrupted, defaulting to the shelf.
      const next = new URLSearchParams(location.search).get('next');
      await this.router.navigateByUrl(next && next.startsWith('/') ? next : '/colecao');
    } catch (err) {
      // The server says "Invalid credentials." for every failure mode on
      // purpose; we pass its message through rather than guessing a friendlier
      // one that might reveal which half was wrong.
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível entrar.');
    } finally {
      this.busy.set(false);
    }
  }
}
