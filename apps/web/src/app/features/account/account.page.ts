import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Privacy } from '@ludoteca/shared';
import { LIMITS } from '@ludoteca/shared/constants';
import { ApiFailure, ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { ThemeService, type ThemeChoice } from '../../core/theme.service';
import { SeatToken } from '../../shared/ui';
import { firstValueFrom } from 'rxjs';

const PRIVACY_COPY: Record<Privacy, { label: string; blurb: string }> = {
  public: { label: 'Público', blurb: 'Qualquer pessoa vê os jogos que você adicionar.' },
  friends: { label: 'Só amigos', blurb: 'Apenas seus amigos veem os jogos que você adicionar.' },
  nobody: { label: 'Só eu', blurb: 'Ninguém além de você vê os jogos que adicionar.' },
};

@Component({
  selector: 'lt-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SeatToken],
  template: `
    <header class="mb-6">
      <h1 class="text-3xl">Conta</h1>
    </header>

    @if (user(); as u) {
      <section class="card mb-5 flex items-center gap-4 p-5">
        <lt-seat [user]="u" />
        <div class="min-w-0">
          <p class="truncate text-lg font-semibold text-strong">{{ u.displayName || u.login }}</p>
          <p class="truncate text-sm text-muted">{{ '@' + u.login }} · {{ u.email }}</p>
        </div>
      </section>

      <section class="panel mb-5 p-5" aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="mb-4 text-lg">Perfil</h2>
        <label class="label" for="displayName">Nome de exibição</label>
        <input id="displayName" class="field mb-2" [(ngModel)]="displayName" [maxlength]="limits.displayName.max" />
        <p class="hint mb-4">É o que seus amigos veem. Deixe em branco para usar seu login.</p>
        <button type="button" class="btn btn-primary btn-sm" (click)="saveProfile()" [disabled]="busy()">Salvar</button>
      </section>

      <section class="panel mb-5 p-5" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" class="mb-1 text-lg">Privacidade padrão</h2>
        <p class="mb-4 text-sm text-muted">
          Vale para os jogos que você adicionar a partir de agora. Os que já estão nas suas listas mantêm a privacidade
          que têm hoje.
        </p>
        <div class="grid gap-2">
          @for (option of privacyOptions; track option) {
            <label
              class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors"
              [style.border-color]="privacy() === option ? 'var(--color-brand-500)' : 'var(--border-subtle)'"
              [style.background]="privacy() === option ? 'color-mix(in srgb, var(--color-brand-500) 8%, transparent)' : 'transparent'"
            >
              <input type="radio" name="privacy" class="mt-1 accent-[var(--color-brand-600)]" [value]="option" [ngModel]="privacy()" (ngModelChange)="setPrivacy($event)" />
              <span>
                <span class="block text-sm font-semibold text-strong">{{ copy(option).label }}</span>
                <span class="block text-xs text-muted">{{ copy(option).blurb }}</span>
              </span>
            </label>
          }
        </div>
      </section>

      <section class="panel mb-5 p-5" aria-labelledby="theme-heading">
        <h2 id="theme-heading" class="mb-4 text-lg">Tema</h2>
        <div class="flex flex-wrap gap-1.5">
          @for (option of themeOptions; track option.value) {
            <button
              type="button"
              class="chip"
              [class.chip-active]="theme.choice() === option.value"
              (click)="theme.set(option.value)"
              [attr.aria-pressed]="theme.choice() === option.value"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </section>

      <section class="panel mb-5 p-5" aria-labelledby="session-heading">
        <h2 id="session-heading" class="mb-4 text-lg">Sessão</h2>
        <button type="button" class="btn btn-ghost btn-sm" (click)="logout()">Sair</button>
      </section>

      @if (notice(); as n) {
        <p role="status" class="mb-4 rounded-xl px-3 py-2 text-sm" style="background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)">
          {{ n }}
        </p>
      }
      @if (error(); as e) {
        <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
      }

      <!-- Danger zone. Irreversible, so it demands the password AND a typed
           confirmation — nobody deletes an account by mis-clicking. -->
      <section class="mb-10 rounded-2xl border p-5" style="border-color: var(--color-danger)" aria-labelledby="danger-heading">
        <h2 id="danger-heading" class="mb-1 text-lg" style="color: var(--color-danger)">Excluir conta</h2>
        <p class="mb-4 text-sm text-muted">
          Apaga sua conta, suas listas, seus grupos e seus empréstimos. Não dá para desfazer.
        </p>

        @if (!confirming()) {
          <button type="button" class="btn btn-danger btn-sm" (click)="confirming.set(true)">Quero excluir minha conta</button>
        } @else {
          <div class="grid gap-3">
            @if (u.hasPassword) {
              <div>
                <label class="label" for="del-password">Sua senha</label>
                <input id="del-password" type="password" class="field" [(ngModel)]="password" autocomplete="current-password" />
              </div>
            }
            <div>
              <label class="label" for="del-confirm">Digite <code class="stat font-bold">DELETE</code> para confirmar</label>
              <input id="del-confirm" class="field" [(ngModel)]="confirmText" autocomplete="off" />
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-danger btn-sm" (click)="deleteAccount()" [disabled]="busy() || confirmText() !== 'DELETE'">
                Excluir definitivamente
              </button>
              <button type="button" class="btn btn-quiet btn-sm" (click)="confirming.set(false)">Cancelar</button>
            </div>
          </div>
        }
      </section>
    }
  `,
})
export class AccountPage {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly limits = LIMITS;
  protected readonly user = this.auth.user;
  protected readonly privacyOptions: Privacy[] = ['public', 'friends', 'nobody'];
  protected readonly themeOptions: Array<{ value: ThemeChoice; label: string }> = [
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Escuro' },
    { value: 'system', label: 'Do sistema' },
  ];

  protected readonly displayName = signal(this.auth.user()?.displayName ?? '');
  protected readonly privacy = signal<Privacy>(this.auth.user()?.defaultGamePrivacy ?? 'public');
  protected readonly password = signal('');
  protected readonly confirmText = signal('');
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected copy(privacy: Privacy) {
    return PRIVACY_COPY[privacy];
  }

  protected async saveProfile(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.auth.updateProfile({ displayName: this.displayName().trim() || null });
      this.notice.set('Perfil salvo.');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível salvar.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async setPrivacy(privacy: Privacy): Promise<void> {
    const previous = this.privacy();
    this.privacy.set(privacy);
    this.error.set(null);
    try {
      await this.auth.updateProfile({ defaultGamePrivacy: privacy });
      this.notice.set(`Novos jogos entram como "${PRIVACY_COPY[privacy].label.toLowerCase()}".`);
    } catch (err) {
      this.privacy.set(previous);
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível alterar a privacidade.');
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/entrar');
  }

  protected async deleteAccount(): Promise<void> {
    if (this.confirmText() !== 'DELETE') return;

    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.delete('/auth/account', {
          ...(this.user()?.hasPassword ? { password: this.password() } : {}),
          confirm: 'DELETE',
        }),
      );
      this.auth.clear();
      await this.router.navigateByUrl('/entrar');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível excluir a conta.');
    } finally {
      this.busy.set(false);
    }
  }
}
