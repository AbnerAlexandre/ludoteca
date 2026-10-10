import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { Icon } from '../../shared/icon';
import { Cover } from '../../shared/ui';
import { FEATURED_GAMES, coverUrl, featuredById, ludopediaLink, thumbUrl, type FeaturedGame } from './featured-games';

const TYPE_LABEL = { board: 'Tabuleiro', cards: 'Cartas' } as const;

/**
 * Public game page for the showcased games (/jogo/:ludopediaId).
 *
 * Everything comes from the hard-coded FEATURED_GAMES, so it renders with no
 * auth and no backend call — a visitor from the landing carousel sees the
 * sheet instantly, synopsis included (Ludopedia's API has none; it's ours).
 * Adding to a list needs an account, so that button routes to sign-up when
 * logged out.
 */
@Component({
  selector: 'lt-game-showcase',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Cover],
  template: `
    <header class="container-app flex h-16 items-center gap-2 sm:h-20">
      <a routerLink="/" class="mr-auto" aria-label="Ludoteca, página inicial">
        <img src="/bdsmlogo.png" alt="" class="h-9 w-auto" />
      </a>
      @if (isAuthed()) {
        <a routerLink="/colecao" class="btn btn-ink btn-sm">Minhas listas</a>
      } @else {
        <a routerLink="/entrar" class="btn btn-quiet btn-sm">Entrar</a>
        <a routerLink="/criar-conta" class="btn btn-ink btn-sm">Criar conta</a>
      }
    </header>

    <main id="conteudo" class="container-app pt-2 pb-20">
      <button type="button" class="back-link" (click)="back()"><lt-icon name="arrow-left" [size]="16" /> Voltar</button>

      @if (game(); as g) {
        <article class="game-grid">
          <div class="area-cover">
            <lt-cover class="cover-hero pop-in aspect-square w-full" [src]="cover(g)" [alt]="'Capa de ' + g.name" [eager]="true" [iconSize]="40" />
          </div>

          <header class="area-head rise min-w-0 self-center lg:self-auto">
            <p class="eyebrow">{{ typeLabel(g.type) }} · {{ g.year }}</p>
            <h1 class="display mt-2 text-[1.7rem] sm:text-[2.6rem] lg:text-[3.2rem]">{{ g.name }}</h1>
            @if (g.originalName && g.originalName !== g.name) {
              <p class="mt-1.5 text-sm text-ink-3">{{ g.originalName }}</p>
            }
          </header>

          <div class="area-body min-w-0">
            <dl class="rise grid grid-cols-2 border-y border-line sm:grid-cols-4" style="--i: 1">
              @for (fact of facts(); track fact.label) {
                <div class="spec">
                  <dt class="eyebrow">{{ fact.label }}</dt>
                  <dd class="num mt-1.5 text-[1.6rem] text-ink">{{ fact.value }}</dd>
                </div>
              }
            </dl>

            <div class="rise mt-6 flex flex-col gap-2 sm:flex-row" style="--i: 2">
              @if (isAuthed()) {
                <button type="button" class="btn btn-primary" (click)="addToCollection(g)" [disabled]="adding() || added()">
                  <lt-icon [name]="added() ? 'check' : 'plus'" [size]="17" />
                  {{ added() ? 'Na sua coleção' : adding() ? 'Adicionando…' : 'Adicionar à coleção' }}
                </button>
              } @else {
                <a routerLink="/criar-conta" class="btn btn-primary"><lt-icon name="plus" [size]="17" /> Criar conta para adicionar</a>
              }
              <a [href]="link(g)" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
                <lt-icon name="cart" [size]="17" /> Comprar na Ludopedia <lt-icon name="external-link" [size]="14" />
              </a>
            </div>

            <section class="rise mt-9" style="--i: 3">
              <h2 class="section-label eyebrow">Sobre o jogo</h2>
              <p class="max-w-2xl text-[1.02rem] leading-relaxed text-ink-2">{{ g.description }}</p>
              <div class="mt-5 flex flex-wrap gap-1.5">
                @for (tag of g.tags; track tag) {
                  <span class="tag text-[0.7rem]">{{ tag }}</span>
                }
              </div>
            </section>

            <section class="rise mt-12" style="--i: 4" aria-labelledby="more-heading">
              <h2 id="more-heading" class="section-label eyebrow">Outros jogos da vitrine</h2>
              <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                @for (other of others(); track other.ludopediaId) {
                  <li>
                    <a [routerLink]="['/jogo', other.ludopediaId]" class="group block">
                      <img [src]="thumb(other)" alt="" class="aspect-square w-full rounded-[var(--r-sm)] object-cover shadow-[var(--box-edge)] transition-transform duration-300 group-hover:-translate-y-1" loading="lazy" />
                      <span class="mt-2 block truncate text-xs font-semibold text-ink-2">{{ other.name }}</span>
                    </a>
                  </li>
                }
              </ul>
            </section>
          </div>
        </article>
      } @else {
        <div class="mx-auto max-w-md py-16">
          <h1 class="display text-[2.2rem]">Este jogo não está na vitrine.</h1>
          <p class="mt-3 text-ink-2">Entre e use a busca para encontrá-lo no catálogo completo da Ludopedia.</p>
          <div class="mt-6 flex gap-3">
            <a routerLink="/buscar" class="btn btn-primary">Buscar jogos</a>
            <a routerLink="/" class="btn btn-ghost">Início</a>
          </div>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .game-grid {
        display: grid;
        grid-template-columns: 7.5rem minmax(0, 1fr);
        grid-template-areas:
          'cover head'
          'body body';
        gap: 1.5rem 1.1rem;
      }
      @media (min-width: 640px) {
        .game-grid {
          grid-template-columns: 11rem minmax(0, 1fr);
          gap: 2rem 1.75rem;
        }
      }
      @media (min-width: 1024px) {
        .game-grid {
          grid-template-columns: 20rem minmax(0, 1fr);
          grid-template-rows: auto 1fr;
          grid-template-areas:
            'cover head'
            'cover body';
          gap: 1.75rem 3rem;
        }
        .area-cover {
          position: sticky;
          top: 1.5rem;
          align-self: start;
        }
      }
      .area-cover {
        grid-area: cover;
      }
      .area-head {
        grid-area: head;
      }
      .area-body {
        grid-area: body;
      }
      .cover-hero {
        border-radius: var(--r);
      }
      .spec {
        padding: 0.95rem 0.25rem;
      }
      .spec + .spec {
        border-left: 1px solid var(--line);
        padding-left: 1rem;
      }
      @media (max-width: 639px) {
        .spec + .spec:nth-child(3) {
          border-left: 0;
          padding-left: 0.25rem;
        }
        .spec:nth-child(n + 3) {
          border-top: 1px solid var(--line);
        }
      }
    `,
  ],
})
export class GameShowcasePage {
  private readonly location = inject(Location);
  private readonly auth = inject(AuthStore);
  private readonly listsService = inject(ListsService);
  private readonly feedback = inject(FeedbackService);

  /** Bound from the route; a string on the wire. */
  readonly ludopediaId = input.required<string>();

  protected readonly isAuthed = this.auth.isAuthenticated;
  protected readonly adding = signal(false);
  /** Which game was added — the component is reused across /jogo/:id. */
  private readonly addedId = signal<number | null>(null);

  protected readonly game = computed<FeaturedGame | undefined>(() => {
    const id = Number(this.ludopediaId());
    return Number.isFinite(id) ? featuredById(id) : undefined;
  });

  protected readonly added = computed(() => this.addedId() !== null && this.addedId() === this.game()?.ludopediaId);

  /** A handful of other showcased games, so the page isn't a dead end. */
  protected readonly others = computed(() => {
    const id = this.game()?.ludopediaId;
    const rest = FEATURED_GAMES.filter((g) => g.ludopediaId !== id);
    const start = rest.length ? (id ?? 0) % rest.length : 0;
    return [...rest.slice(start), ...rest.slice(0, start)].slice(0, 5);
  });

  protected readonly facts = computed(() => {
    const g = this.game();
    if (!g) return [];
    const players = g.maxPlayers > g.minPlayers ? `${g.minPlayers}–${g.maxPlayers}` : `${g.minPlayers}`;
    return [
      { label: 'Jogadores', value: players },
      { label: 'Duração', value: `${g.playTimeMinutes}′` },
      { label: 'Idade', value: `${g.minAge}+` },
      { label: 'Lançamento', value: String(g.year) },
    ];
  });

  protected typeLabel(type: 'board' | 'cards'): string {
    return TYPE_LABEL[type];
  }
  protected cover(g: FeaturedGame): string {
    return coverUrl(g.ludopediaId);
  }
  protected thumb(g: FeaturedGame): string {
    return thumbUrl(g.ludopediaId);
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
    try {
      const lists = await this.listsService.lists();
      const collection = lists.find((l) => l.kind === 'collection') ?? lists[0];
      if (!collection) throw new Error('no-list');
      await this.listsService.addItem(collection.publicId, { ludopediaId: g.ludopediaId });
      this.addedId.set(g.ludopediaId);
      this.feedback.success(`${g.name} foi para ${collection.name}.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar agora.');
    } finally {
      this.adding.set(false);
    }
  }
}
