import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { ListsService } from '../../core/lists.service';
import { ApiFailure } from '../../core/api.service';
import { Icon } from '../../shared/icon';
import { featuredById, coverUrl, ludopediaLink, type FeaturedGame } from './featured-games';

const TYPE_LABEL = { board: 'Tabuleiro', cards: 'Cartas' } as const;

/**
 * Public game page for the showcased games (/jogo/:ludopediaId).
 *
 * Everything it shows comes from the hard-coded FEATURED_GAMES, so it renders
 * with no auth and no backend call — a visitor coming from the landing marquee
 * sees the full sheet instantly, including the synopsis (which Ludopedia's API
 * doesn't provide, so it lives in our data).
 *
 * The in-app game page (/jogos/:publicId) is the authed, cache-backed one; this
 * is its public sibling for the featured set. Adding to a list still needs an
 * account, so that button routes to sign-up when logged out.
 */
@Component({
  selector: 'lt-game-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="min-h-dvh bg-page">
      <header>
        <div class="container-app flex h-16 items-center gap-3">
          <button type="button" class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong" (click)="back()">
            <lt-icon name="arrow-left" [size]="16" /> Voltar
          </button>
          <div class="flex-1"></div>
          <a routerLink="/" class="flex items-center" aria-label="Ludoteca">
            <img src="/bdsmlogo.png" alt="Ludoteca" class="h-8 w-auto" />
          </a>
        </div>
      </header>

      <main class="container-app py-6">
        @if (game(); as g) {
          <article class="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <div>
              <img
                [src]="cover(g)"
                [alt]="'Capa de ' + g.name"
                class="animate-rise w-full rounded-2xl object-cover shadow-xl"
                style="background: var(--surface-sunken)"
                loading="eager"
              />
              <div class="mt-3 grid gap-2">
                <a [href]="link(g)" target="_blank" rel="noopener noreferrer" class="btn btn-primary w-full">
                  <lt-icon name="cart" [size]="18" />
                  Comprar na Ludopedia
                  <lt-icon name="external-link" [size]="14" />
                </a>

                @if (isAuthed()) {
                  <button type="button" class="btn btn-ghost w-full" (click)="addToCollection(g)" [disabled]="adding()">
                    <lt-icon name="plus" [size]="17" />
                    {{ adding() ? 'Adicionando…' : 'Adicionar à coleção' }}
                  </button>
                } @else {
                  <a routerLink="/criar-conta" class="btn btn-ghost w-full">
                    <lt-icon name="plus" [size]="17" />
                    Criar conta para adicionar
                  </a>
                }

                @if (notice(); as n) {
                  <p role="status" class="rounded-xl px-3 py-2 text-xs" style="background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)">
                    {{ n }}
                  </p>
                }
                @if (error(); as e) {
                  <p role="alert" class="text-xs" style="color: var(--color-danger)">{{ e }}</p>
                }
              </div>
            </div>

            <div class="min-w-0">
              <h1 class="text-4xl sm:text-5xl">{{ g.name }}</h1>
              @if (g.originalName && g.originalName !== g.name) {
                <p class="mt-1 text-sm text-muted">{{ g.originalName }}</p>
              }

              <div class="mt-3 flex flex-wrap gap-1.5">
                <span class="chip chip-active">{{ typeLabel(g.type) }}</span>
                @for (tag of g.tags; track tag) {
                  <span class="chip">{{ tag }}</span>
                }
              </div>

              <dl class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                @for (fact of facts(); track fact.label) {
                  <div class="panel p-3">
                    <dt class="flex items-center gap-1.5 text-xs text-muted">
                      <lt-icon [name]="fact.icon" [size]="14" />
                      {{ fact.label }}
                    </dt>
                    <dd class="stat mt-1 text-lg font-bold text-strong">{{ fact.value }}</dd>
                  </div>
                }
              </dl>

              <section class="mt-6">
                <h2 class="mb-2 text-lg">Sobre o jogo</h2>
                <p class="max-w-2xl leading-relaxed text-body">{{ g.description }}</p>
              </section>
            </div>
          </article>
        } @else {
          <div class="mx-auto max-w-md py-20 text-center">
            <div class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-muted" style="background: var(--surface-sunken)">
              <lt-icon name="search" [size]="26" />
            </div>
            <h1 class="mb-1 text-xl">Jogo não encontrado por aqui</h1>
            <p class="mb-5 text-sm text-muted">
              Este jogo não está na nossa vitrine. Entre e use a busca para encontrá-lo no catálogo completo da Ludopedia.
            </p>
            <div class="flex justify-center gap-3">
              <a routerLink="/buscar" class="btn btn-primary">Buscar jogos</a>
              <a routerLink="/" class="btn btn-ghost">Voltar ao início</a>
            </div>
          </div>
        }
      </main>
    </div>
  `,
})
export class GameShowcasePage {
  private readonly location = inject(Location);
  private readonly auth = inject(AuthStore);
  private readonly listsService = inject(ListsService);

  /** Bound from the route; a string on the wire. */
  readonly ludopediaId = input.required<string>();

  protected readonly isAuthed = this.auth.isAuthenticated;
  protected readonly adding = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly game = computed<FeaturedGame | undefined>(() => {
    const id = Number(this.ludopediaId());
    return Number.isFinite(id) ? featuredById(id) : undefined;
  });

  protected readonly facts = computed(() => {
    const g = this.game();
    if (!g) return [];
    const players = g.maxPlayers > g.minPlayers ? `${g.minPlayers}–${g.maxPlayers}` : `${g.minPlayers}`;
    return [
      { icon: 'calendar' as const, label: 'Ano', value: String(g.year) },
      { icon: 'users' as const, label: 'Jogadores', value: players },
      { icon: 'clock' as const, label: 'Duração', value: `${g.playTimeMinutes} min` },
      { icon: 'star' as const, label: 'Idade', value: `${g.minAge}+` },
    ];
  });

  protected typeLabel(type: 'board' | 'cards'): string {
    return TYPE_LABEL[type];
  }
  protected cover(g: FeaturedGame): string {
    return coverUrl(g.ludopediaId);
  }
  protected link(g: FeaturedGame): string {
    return ludopediaLink(g.ludopediaId);
  }

  protected back(): void {
    this.location.back();
  }

  /** Adds the game to the caller's collection list by its Ludopedia id. */
  protected async addToCollection(g: FeaturedGame): Promise<void> {
    this.adding.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const lists = await this.listsService.lists();
      const collection = lists.find((l) => l.kind === 'collection') ?? lists[0];
      if (!collection) throw new Error('no-list');
      await this.listsService.addItem(collection.publicId, { ludopediaId: g.ludopediaId });
      this.notice.set(`${g.name} foi para ${collection.name}.`);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar agora.');
    } finally {
      this.adding.set(false);
    }
  }
}
