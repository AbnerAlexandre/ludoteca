import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProfileList, UserProfile } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { SocialService } from '../../core/social.service';
import { Icon, type IconName } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

const KIND_ICON: Record<ProfileList['kind'], IconName> = {
  collection: 'dice',
  wishlist: 'star',
  favorites: 'heart',
  custom: 'list',
};

/**
 * A user's public profile. Everything shown is already filtered by the backend
 * to what this viewer may see — the list counts and the headline stat never
 * exceed what the privacy rules allow, and fully-hidden lists simply aren't
 * returned. So the page can't become a side channel around per-item privacy.
 */
@Component({
  selector: 'lt-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SeatToken, Skeleton, EmptyState],
  template: `
    @if (loading()) {
      <div class="mx-auto max-w-2xl">
        <div class="card flex items-center gap-4 p-6"><lt-skeleton height="3.5rem" width="3.5rem" /><lt-skeleton height="1.5rem" width="40%" /></div>
      </div>
    } @else if (error(); as e) {
      <lt-empty icon="user" title="Perfil indisponível" [message]="e" />
    } @else if (profile(); as p) {
      <div class="mx-auto max-w-2xl">
        <header class="card mb-5 flex flex-wrap items-center gap-4 p-6">
          <lt-seat [user]="p.user" />
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-2xl">{{ p.user.displayName || p.user.login }}</h1>
            <p class="truncate text-sm text-muted">{{ '@' + p.user.login }}</p>
          </div>
          @if (isSelf()) {
            <a routerLink="/conta" class="btn btn-ghost btn-sm">Editar perfil</a>
          } @else if (p.user.relation === 'friend') {
            <span class="chip">Amigo</span>
          }
        </header>

        <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="panel p-4">
            <p class="stat text-2xl font-bold text-strong">{{ p.visibleGameCount }}</p>
            <p class="text-xs text-muted">{{ p.visibleGameCount === 1 ? 'jogo visível' : 'jogos visíveis' }}</p>
          </div>
          <div class="panel p-4">
            <p class="stat text-2xl font-bold text-strong">{{ p.lists.length }}</p>
            <p class="text-xs text-muted">{{ p.lists.length === 1 ? 'lista' : 'listas' }}</p>
          </div>
          <div class="panel col-span-2 flex items-center gap-2 p-4 sm:col-span-1">
            <lt-icon name="calendar" [size]="18" class="text-muted" />
            <div>
              <p class="text-sm font-semibold text-strong">Membro desde</p>
              <p class="stat text-xs text-muted">{{ memberSince() }}</p>
            </div>
          </div>
        </div>

        <h2 class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Listas</h2>
        @if (p.lists.length === 0) {
          <lt-empty icon="list" title="Nada por aqui" [message]="isSelf() ? 'Você ainda não tem jogos nas listas.' : 'Este usuário não tem listas visíveis para você.'" />
        } @else {
          <ul class="grid gap-2 sm:grid-cols-2">
            @for (list of p.lists; track list.publicId) {
              <li>
                <a [routerLink]="['/listas', list.publicId]" class="card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)">
                    <lt-icon [name]="icon(list)" [size]="18" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold text-strong">{{ list.name }}</span>
                    <span class="text-xs text-muted">
                      <span class="stat">{{ list.visibleItemCount }}</span> {{ list.visibleItemCount === 1 ? 'jogo' : 'jogos' }}
                    </span>
                  </span>
                </a>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class ProfilePage {
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthStore);

  readonly userId = input.required<string>();

  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly isSelf = computed(() => this.profile()?.user.relation === 'self');
  protected readonly memberSince = computed(() => {
    const iso = this.profile()?.memberSince;
    return iso ? new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected icon(list: ProfileList): IconName {
    return KIND_ICON[list.kind];
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.profile.set(await this.social.profile(this.userId()));
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o perfil.');
    } finally {
      this.loading.set(false);
    }
  }
}
