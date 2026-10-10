import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProfileList, UserProfile } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

const KIND_META: Record<ProfileList['kind'], { color: string; ink: string; label: string }> = {
  collection: { color: 'var(--brand)', ink: '#fff', label: 'Coleção' },
  wishlist: { color: 'var(--amber)', ink: '#2a1b00', label: 'Desejos' },
  favorites: { color: 'var(--rose)', ink: '#fff', label: 'Favoritos' },
  custom: { color: 'var(--teal)', ink: '#fff', label: 'Lista' },
};

/**
 * A user's public profile. Everything shown is already filtered by the backend
 * to what this viewer may see — the counts never exceed what the privacy rules
 * allow, and fully-hidden lists simply aren't returned. So the page can't
 * become a side channel around per-item privacy.
 */
@Component({
  selector: 'lt-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SeatToken, Skeleton, EmptyState],
  template: `
    @if (loading()) {
      <div class="flex items-center gap-5">
        <lt-skeleton height="4.5rem" width="4.5rem" />
        <div class="flex-1 space-y-2"><lt-skeleton height="0.75rem" width="25%" /><lt-skeleton height="2rem" width="45%" /></div>
      </div>
    } @else if (error(); as e) {
      <lt-empty title="Perfil indisponível" [message]="e">
        <a routerLink="/amigos" class="btn btn-ghost">Ir para amigos</a>
      </lt-empty>
    } @else if (profile(); as p) {
      <header class="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <span class="pop-in"><lt-seat [user]="p.user" size="xl" /></span>
        <div class="rise min-w-0 flex-1">
          <p class="eyebrow mb-2">Na Ludoteca desde {{ memberSince() }}</p>
          <h1 class="display truncate text-[2.15rem] sm:text-[2.75rem]">{{ p.user.displayName || p.user.login }}</h1>
          <p class="mt-2 flex items-center gap-2">
            <span class="meta">{{ '@' + p.user.login }}</span>
            @if (p.user.relation === 'friend') {
              <span class="tag tag-mint">Amigo</span>
            }
          </p>
        </div>
        @if (isSelf()) {
          <a routerLink="/conta" class="btn btn-ghost rise" style="--i: 2"><lt-icon name="settings" [size]="17" /> Editar perfil</a>
        } @else if (p.user.relation !== 'friend') {
          <a routerLink="/amigos" class="btn btn-ghost rise" style="--i: 2"><lt-icon name="friends" [size]="17" /> Amigos</a>
        }
      </header>

      <dl class="rise mb-10 grid grid-cols-2 border-y border-line" style="--i: 2">
        <div class="py-4 pr-4">
          <dt class="eyebrow">{{ isSelf() ? 'Jogos nas listas' : 'Jogos visíveis' }}</dt>
          <dd class="num mt-1.5 text-[2rem] text-ink">{{ p.visibleGameCount }}</dd>
        </div>
        <div class="border-l border-line py-4 pl-5">
          <dt class="eyebrow">Listas</dt>
          <dd class="num mt-1.5 text-[2rem] text-ink">{{ p.lists.length }}</dd>
        </div>
      </dl>

      <section aria-labelledby="lists-heading">
        <h2 id="lists-heading" class="section-label eyebrow">Listas</h2>
        @if (p.lists.length === 0) {
          <lt-empty title="Nada por aqui" [message]="isSelf() ? 'Você ainda não tem jogos nas listas.' : 'Esta pessoa não tem listas visíveis para você.'" />
        } @else {
          <ul class="rows">
            @for (list of p.lists; track list.publicId; let i = $index) {
              <li class="fade-in" [style.--i]="i">
                <a [routerLink]="['/listas', list.publicId]" class="row row-hover group">
                  <span class="tile h-11 w-10 text-xl" [style.background]="meta(list).color" [style.color]="meta(list).ink" aria-hidden="true">
                    {{ list.name.trim()[0]?.toUpperCase() }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold text-ink">{{ list.name }}</span>
                    <span class="meta">{{ list.visibleItemCount }} {{ list.visibleItemCount === 1 ? 'jogo' : 'jogos' }}</span>
                  </span>
                  <lt-icon name="chevron-right" [size]="18" class="text-ink-3 transition-transform group-hover:translate-x-1" />
                </a>
              </li>
            }
          </ul>
        }
        @if (!isSelf() && p.user.relation !== 'friend') {
          <p class="hint mt-4">Você vê só o que esta pessoa deixou público. Amigos podem ver mais.</p>
        }
      </section>
    }
  `,
})
export class ProfilePage {
  private readonly social = inject(SocialService);

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
    // An effect, not a one-off load: going from someone's profile to "Meu
    // perfil" reuses this component with a new id.
    effect(() => {
      const id = this.userId();
      untracked(() => void this.load(id));
    });
  }

  protected meta(list: ProfileList) {
    return KIND_META[list.kind];
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.profile.set(await this.social.profile(id));
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o perfil.');
    } finally {
      this.loading.set(false);
    }
  }
}
