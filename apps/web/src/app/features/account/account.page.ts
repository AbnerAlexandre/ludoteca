import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Privacy } from '@ludoteca/shared';
import { LIMITS } from '@ludoteca/shared/constants';
import { firstValueFrom } from 'rxjs';
import { ApiFailure, ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { FeedbackService } from '../../core/feedback.service';
import { ThemeService, type ThemeChoice } from '../../core/theme.service';
import { Icon, type IconName } from '../../shared/icon';
import { PageHead, SeatToken } from '../../shared/ui';

const PRIVACY_COPY: Record<Privacy, { label: string; blurb: string; icon: IconName }> = {
  public: { label: 'Público', blurb: 'Qualquer pessoa vê os jogos que você adicionar.', icon: 'globe' },
  friends: { label: 'Só amigos', blurb: 'Apenas seus amigos veem os jogos que você adicionar.', icon: 'users' },
  nobody: { label: 'Só eu', blurb: 'Ninguém além de você vê os jogos que adicionar.', icon: 'lock' },
};

/**
 * Settings, laid out the way settings read best: what a section is on the
 * left, its control on the right (stacked on a phone). No card per section —
 * the page already has structure; hairlines are enough.
 */
@Component({
  selector: 'lt-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Icon, PageHead],
  template: `
    <lt-page-head eyebrow="Configurações" title="Conta e privacidade" />

    @if (user(); as u) {
      <section class="rise mb-10 flex flex-wrap items-center gap-4" style="--i: 2">
        <lt-seat [user]="u" size="lg" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-bold text-ink">{{ u.displayName || u.login }}</p>
          <p class="meta truncate">{{ '@' + u.login }} · {{ u.email }}</p>
        </div>
        <a [routerLink]="['/perfil', u.publicId]" class="btn btn-ghost btn-sm">Ver meu perfil <lt-icon name="arrow-right" [size]="15" /></a>
      </section>

      <div class="settings">
        <section class="setting" aria-labelledby="profile-heading">
          <div>
            <h2 id="profile-heading" class="setting-title">Nome de exibição</h2>
            <p class="setting-desc">É o que seus amigos veem. Em branco, usamos o seu login.</p>
          </div>
          <form class="flex flex-col gap-2 sm:flex-row" (ngSubmit)="saveProfile()">
            <label class="sr-only" for="displayName">Nome de exibição</label>
            <input id="displayName" class="field" [(ngModel)]="displayName" name="displayName" [maxlength]="limits.displayName.max" [placeholder]="u.login" />
            <button type="submit" class="btn btn-ink shrink-0" [disabled]="busy() || displayName().trim() === (u.displayName ?? '')">Salvar</button>
          </form>
        </section>

        <section class="setting" aria-labelledby="privacy-heading">
          <div>
            <h2 id="privacy-heading" class="setting-title">Privacidade padrão</h2>
            <p class="setting-desc">Vale para os jogos que você adicionar daqui em diante. Os que já estão nas listas mantêm a privacidade de hoje — mude por jogo na lista.</p>
          </div>
          <div class="grid gap-2" role="radiogroup" aria-labelledby="privacy-heading">
            @for (option of privacyOptions; track option) {
              <label class="choice">
                <input type="radio" name="privacy" [value]="option" [ngModel]="privacy()" (ngModelChange)="setPrivacy($event)" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-semibold text-ink"><lt-icon [name]="copy(option).icon" [size]="15" /> {{ copy(option).label }}</span>
                  <span class="mt-0.5 block text-xs text-ink-3">{{ copy(option).blurb }}</span>
                </span>
              </label>
            }
          </div>
        </section>

        <section class="setting" aria-labelledby="theme-heading">
          <div>
            <h2 id="theme-heading" class="setting-title">Aparência</h2>
            <p class="setting-desc">"Sistema" acompanha o modo do seu aparelho — escurece à noite se ele escurecer.</p>
          </div>
          <div class="seg w-full sm:w-auto" role="group" aria-labelledby="theme-heading">
            @for (option of themeOptions; track option.value) {
              <button type="button" class="flex-1" [attr.aria-pressed]="theme.choice() === option.value" (click)="theme.set(option.value)">
                <lt-icon [name]="option.icon" [size]="15" /> {{ option.label }}
              </button>
            }
          </div>
        </section>

        <section class="setting" aria-labelledby="session-heading">
          <div>
            <h2 id="session-heading" class="setting-title">Sessão</h2>
            <p class="setting-desc">Sai deste aparelho. Seus dados continuam salvos.</p>
          </div>
          <div><button type="button" class="btn btn-ghost" (click)="logout()"><lt-icon name="logout" [size]="17" /> Sair</button></div>
        </section>

        <!-- Danger zone. Irreversible, so it demands the password AND a typed
             confirmation — nobody deletes an account by mis-clicking. -->
        <section class="setting" aria-labelledby="danger-heading">
          <div>
            <h2 id="danger-heading" class="setting-title text-danger!">Excluir conta</h2>
            <p class="setting-desc">Apaga sua conta, listas, grupos e empréstimos. Não dá para desfazer.</p>
          </div>
          @if (!confirming()) {
            <div><button type="button" class="btn btn-danger-quiet border-danger!" (click)="confirming.set(true)">Quero excluir minha conta</button></div>
          } @else {
            <div class="fade-in grid gap-4 rounded-[var(--r-lg)] border border-danger p-4">
              @if (u.hasPassword) {
                <div>
                  <label class="label" for="del-password">Sua senha</label>
                  <input id="del-password" type="password" class="field" [(ngModel)]="password" autocomplete="current-password" />
                </div>
              }
              <div>
                <label class="label" for="del-confirm">Digite <code class="stat font-bold text-danger">DELETE</code> para confirmar</label>
                <input id="del-confirm" class="field" [(ngModel)]="confirmText" autocomplete="off" autocapitalize="characters" />
              </div>
              <div class="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" class="btn btn-ghost" (click)="confirming.set(false)">Cancelar</button>
                <button type="button" class="btn btn-danger" (click)="deleteAccount()" [disabled]="busy() || confirmText() !== 'DELETE'">Excluir definitivamente</button>
              </div>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [
    `
      .settings {
        border-top: 1px solid var(--line);
      }
      .setting {
        display: grid;
        gap: 1rem;
        padding: 1.6rem 0;
        border-bottom: 1px solid var(--line);
      }
      @media (min-width: 1024px) {
        .setting {
          grid-template-columns: 19rem minmax(0, 34rem);
          gap: 3rem;
        }
      }
      .setting-title {
        font-size: 1.1rem;
      }
      .setting-desc {
        margin-top: 0.35rem;
        font-size: 0.85rem;
        color: var(--ink-3);
        max-width: 26rem;
      }
    `,
  ],
})
export class AccountPage {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  protected readonly theme = inject(ThemeService);

  protected readonly limits = LIMITS;
  protected readonly user = this.auth.user;
  protected readonly privacyOptions: Privacy[] = ['public', 'friends', 'nobody'];
  protected readonly themeOptions: Array<{ value: ThemeChoice; label: string; icon: IconName }> = [
    { value: 'light', label: 'Claro', icon: 'sun' },
    { value: 'dark', label: 'Escuro', icon: 'moon' },
    { value: 'system', label: 'Sistema', icon: 'monitor' },
  ];

  protected readonly displayName = signal(this.auth.user()?.displayName ?? '');
  protected readonly privacy = signal<Privacy>(this.auth.user()?.defaultGamePrivacy ?? 'public');
  protected readonly password = signal('');
  protected readonly confirmText = signal('');
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);

  protected copy(privacy: Privacy) {
    return PRIVACY_COPY[privacy];
  }

  protected async saveProfile(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.updateProfile({ displayName: this.displayName().trim() || null });
      this.feedback.success('Nome salvo.');
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível salvar.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async setPrivacy(privacy: Privacy): Promise<void> {
    const previous = this.privacy();
    this.privacy.set(privacy);
    try {
      await this.auth.updateProfile({ defaultGamePrivacy: privacy });
      this.feedback.success(`Novos jogos entram como "${PRIVACY_COPY[privacy].label.toLowerCase()}".`);
    } catch (err) {
      this.privacy.set(previous);
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível alterar a privacidade.');
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/entrar');
  }

  protected async deleteAccount(): Promise<void> {
    if (this.confirmText() !== 'DELETE') return;

    this.busy.set(true);
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
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível excluir a conta.');
    } finally {
      this.busy.set(false);
    }
  }
}
