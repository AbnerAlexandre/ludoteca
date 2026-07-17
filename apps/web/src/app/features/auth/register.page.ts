import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LIMITS } from '@ludoteca/shared/constants';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'lt-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  template: `
    <lt-auth-layout
      eyebrow="Comece agora"
      title="Monte sua ludoteca."
      subtitle="Catalogue seus jogos, empreste para amigos e nunca mais esqueça com quem ficou o Catan."
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">
        <div>
          <label class="label" for="login">Login</label>
          <input
            id="login"
            type="text"
            class="field"
            formControlName="login"
            autocomplete="username"
            [class.field-invalid]="invalid('login')"
            [attr.aria-invalid]="invalid('login')"
          />
          @if (invalid('login')) {
            <p class="error-text mt-1">
              De {{ limits.login.min }} a {{ limits.login.max }} caracteres: letras, números, ponto, hífen ou
              underline.
            </p>
          } @else {
            <p class="hint mt-1">É assim que seus amigos vão te encontrar.</p>
          }
        </div>

        <div>
          <label class="label" for="email">E-mail</label>
          <input
            id="email"
            type="email"
            class="field"
            formControlName="email"
            autocomplete="email"
            [class.field-invalid]="invalid('email')"
            [attr.aria-invalid]="invalid('email')"
          />
          @if (invalid('email')) {
            <p class="error-text mt-1">Informe um e-mail válido.</p>
          }
        </div>

        <div>
          <label class="label" for="password">Senha</label>
          <input
            id="password"
            type="password"
            class="field"
            formControlName="password"
            autocomplete="new-password"
            [class.field-invalid]="invalid('password')"
            [attr.aria-invalid]="invalid('password')"
          />
          @if (invalid('password')) {
            <p class="error-text mt-1">Use pelo menos {{ limits.password.min }} caracteres.</p>
          } @else {
            <p class="hint mt-1">Mínimo de {{ limits.password.min }} caracteres. Tamanho vale mais que símbolos.</p>
          }
        </div>

        @if (error(); as e) {
          <p
            role="alert"
            class="rounded-xl px-3 py-2 text-sm"
            style="background: color-mix(in srgb, var(--color-danger) 12%, transparent); color: var(--color-danger)"
          >
            {{ e }}
          </p>
        }

        <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">
          {{ busy() ? 'Criando…' : 'Criar conta' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-muted">
        Já tem conta?
        <a routerLink="/entrar" class="font-semibold" style="color: var(--color-brand-500)">Entrar</a>
      </p>
    </lt-auth-layout>
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);

  protected readonly limits = LIMITS;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /**
   * These rules mirror the zod schemas in @ludoteca/shared, so the form catches
   * what the API would reject. The server still validates everything — this is
   * for feedback, not for enforcement.
   */
  protected readonly form = this.fb.nonNullable.group({
    login: [
      '',
      [
        Validators.required,
        Validators.minLength(LIMITS.login.min),
        Validators.maxLength(LIMITS.login.max),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/),
      ],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(LIMITS.email.max)]],
    password: [
      '',
      [Validators.required, Validators.minLength(LIMITS.password.min), Validators.maxLength(LIMITS.password.max)],
    ],
  });

  protected invalid(name: 'login' | 'email' | 'password'): boolean {
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
      await this.auth.register(this.form.getRawValue());
      await this.router.navigateByUrl('/colecao');
    } catch (err) {
      if (err instanceof ApiFailure && err.isValidation && err.fields) {
        for (const [field, message] of Object.entries(err.fields)) {
          const control = this.form.get(field);
          if (control) control.setErrors({ server: message });
        }
      }
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível criar a conta.');
    } finally {
      this.busy.set(false);
    }
  }
}
