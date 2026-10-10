import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { GAME_TYPE_LABELS, type GameDetail, type List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { GamesService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Cover, Skeleton } from '../../shared/ui';
import { featuredById } from '../landing/featured-games';

/**
 * The full sheet for one game, from the Ludopedia cache.
 *
 * On what's shown and what isn't: Ludopedia's API exposes no rating and no
 * image gallery (`/notas` and `/imagens` are documented as "não implementado").
 * What it does give is the cover plus community counters — how many people
 * own, want, favourite and have played it. Those are presented as popularity,
 * never dressed up as a score we don't have.
 *
 * Layout: on a phone the cover sits beside the title instead of filling the
 * screen above it, so the add-to-list row is reachable without scrolling.
 */
@Component({
  selector: 'lt-game-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Skeleton, Cover],
  template: `
    <button type="button" class="back-link" (click)="back()"><lt-icon name="arrow-left" [size]="16" /> Voltar</button>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-4">{{ e }}</p>
    }

    @if (loading()) {
      <div class="game-grid">
        <div class="area-cover"><lt-skeleton height="100%" /></div>
        <div class="area-head space-y-3">
          <lt-skeleton height="0.75rem" width="30%" />
          <lt-skeleton height="2.4rem" width="70%" />
        </div>
        <div class="area-body space-y-3"><lt-skeleton height="5rem" /><lt-skeleton height="7rem" /></div>
      </div>
    } @else if (game(); as g) {
      <article class="game-grid">
        <div class="area-cover">
          <lt-cover class="cover-hero pop-in aspect-square w-full" [src]="g.coverUrl ?? g.thumbnail" [alt]="'Capa de ' + g.name" [eager]="true" [iconSize]="40" />
          @if (g.link) {
            <!-- The API exposes no purchase URL; Ludopedia's own page carries
                 the store listings, so that's the honest link. -->
            <a [href]="g.link" target="_blank" rel="noopener noreferrer" class="btn btn-ghost mt-4 hidden w-full lg:inline-flex">
              <lt-icon name="cart" [size]="17" /> Comprar na Ludopedia <lt-icon name="external-link" [size]="14" />
            </a>
          }
        </div>

        <header class="area-head rise min-w-0 self-center lg:self-auto">
          <p class="eyebrow">{{ typeLabel(g.type) }}{{ g.year ? ' · ' + g.year : '' }}</p>
          <h1 class="display mt-2 text-[1.7rem] sm:text-[2.6rem] lg:text-[3.2rem]">{{ g.name }}</h1>
          @if (g.originalName && g.originalName !== g.name) {
            <p class="mt-1.5 text-sm text-ink-3">{{ g.originalName }}</p>
          }
        </header>

        <div class="area-body min-w-0">
          <!-- The numbers you check before putting it on the table. -->
          @if (facts().length) {
            <dl class="rise grid grid-cols-2 border-y border-line sm:grid-cols-4" style="--i: 1">
              @for (fact of facts(); track fact.label) {
                <div class="spec">
                  <dt class="eyebrow">{{ fact.label }}</dt>
                  <dd class="num mt-1.5 text-[1.6rem] text-ink">{{ fact.value }}</dd>
                </div>
              }
            </dl>
          }

          <!-- One tap per list; each confirms in place. Adding twice is a no-op
               on the API, so a ✓ is always the truth. -->
          <section class="rise mt-6" style="--i: 2" aria-labelledby="add-heading">
            <p id="add-heading" class="eyebrow mb-2.5">Adicionar a uma lista</p>
            <div class="flex flex-wrap gap-2">
              @for (list of lists(); track list.publicId) {
                <button
                  type="button"
                  class="chip"
                  [class.is-done]="added().has(list.publicId)"
                  (click)="add(list)"
                  [disabled]="adding() === list.publicId"
                  [attr.aria-label]="(added().has(list.publicId) ? 'Já está em ' : 'Adicionar a ') + list.name"
                >
                  <lt-icon [name]="added().has(list.publicId) ? 'check' : 'plus'" [size]="15" [strokeWidth]="2.4" />
                  {{ list.name }}
                </button>
              }
            </div>
            @if (g.link) {
              <a [href]="g.link" target="_blank" rel="noopener noreferrer" class="link mt-4 inline-flex items-center gap-1.5 text-sm lg:hidden">
                Comprar na Ludopedia <lt-icon name="external-link" [size]="14" />
              </a>
            }
          </section>

          <!-- Synopsis, when we have one: the API has no description field, so
               it comes from our featured-games data. -->
          @if (description(); as text) {
            <section class="rise mt-9" style="--i: 3">
              <h2 class="section-label eyebrow">Sobre o jogo</h2>
              <p class="max-w-2xl text-[1.02rem] leading-relaxed text-ink-2">{{ text }}</p>
            </section>
          }

          <!-- Popularity, labelled as what it is. Ludopedia has no rating. -->
          @if (communityStats().length) {
            <section class="rise mt-9" style="--i: 4" aria-labelledby="pop-heading">
              <h2 id="pop-heading" class="section-label eyebrow">Na comunidade Ludopedia</h2>
              <div class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                @for (stat of communityStats(); track stat.label) {
                  <div>
                    <p class="num text-[1.6rem] text-ink">{{ stat.value }}</p>
                    <p class="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                      <span class="h-2 w-2 rounded-full" [style.background]="stat.color"></span>{{ stat.label }}
                    </p>
                  </div>
                }
              </div>
            </section>
          }

          @if (g.categories.length || g.mechanics.length || g.themes.length) {
            <section class="rise mt-9 grid gap-6" style="--i: 5">
              @for (group of tagGroups(g); track group.label) {
                @if (group.items.length) {
                  <div>
                    <h2 class="section-label eyebrow">{{ group.label }}</h2>
                    <div class="flex flex-wrap gap-1.5">
                      @for (item of group.items; track item) {
                        <span class="tag text-[0.7rem]">{{ item }}</span>
                      }
                    </div>
                  </div>
                }
              }
            </section>
          }

          @if (g.designers.length || g.artists.length) {
            <section class="rise mt-9 grid gap-6 sm:grid-cols-2" style="--i: 6">
              @if (g.designers.length) {
                <div>
                  <h2 class="section-label eyebrow">Design</h2>
                  <ul class="space-y-1 text-sm text-ink-2">
                    @for (person of g.designers; track person) {
                      <li>{{ person }}</li>
                    }
                  </ul>
                </div>
              }
              @if (g.artists.length) {
                <div>
                  <h2 class="section-label eyebrow">Arte</h2>
                  <ul class="space-y-1 text-sm text-ink-2">
                    @for (person of g.artists; track person) {
                      <li>{{ person }}</li>
                    }
                  </ul>
                </div>
              }
            </section>
          }
        </div>
      </article>
    }
  `,
  styles: [
    `
      /* Phone: cover beside the title, details below.
         Desktop: cover column (sticky) beside everything. */
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
          grid-template-columns: 19rem minmax(0, 1fr);
          grid-template-rows: auto 1fr;
          grid-template-areas:
            'cover head'
            'cover body';
          gap: 1.75rem 3rem;
        }
        .area-cover {
          position: sticky;
          top: calc(var(--header-h) + 1.5rem);
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
        --tilt: -1.5deg;
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

      .chip.is-done {
        background: var(--mint-soft);
        border-color: transparent;
        color: var(--mint);
      }
    `,
  ],
})
export class GameDetailPage {
  private readonly games = inject(GamesService);
  private readonly listsService = inject(ListsService);
  private readonly location = inject(Location);
  private readonly feedback = inject(FeedbackService);

  readonly gameId = input.required<string>();

  protected readonly game = signal<GameDetail | null>(null);
  protected readonly lists = signal<List[]>([]);
  protected readonly added = signal<ReadonlySet<string>>(new Set());
  protected readonly loading = signal(true);
  protected readonly adding = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Synopsis for the featured games — Ludopedia's API provides none. */
  protected readonly description = computed(() => {
    const g = this.game();
    return g ? (featuredById(g.ludopediaId)?.description ?? null) : null;
  });

  /** Only the facts upstream actually knows — a null field is left out entirely. */
  protected readonly facts = computed(() => {
    const g = this.game();
    if (!g) return [];
    const rows: Array<{ label: string; value: string }> = [];
    if (g.minPlayers)
      rows.push({
        label: 'Jogadores',
        value: g.maxPlayers && g.maxPlayers !== g.minPlayers ? `${g.minPlayers}–${g.maxPlayers}` : String(g.minPlayers),
      });
    if (g.playTimeMinutes) rows.push({ label: 'Duração', value: `${g.playTimeMinutes}′` });
    if (g.minAge) rows.push({ label: 'Idade', value: `${g.minAge}+` });
    if (g.year) rows.push({ label: 'Lançamento', value: String(g.year) });
    return rows;
  });

  protected readonly communityStats = computed(() => {
    const g = this.game();
    if (!g) return [];
    return [
      { label: 'têm', value: g.ownedCount, color: 'var(--brand)' },
      { label: 'querem', value: g.wantedCount, color: 'var(--amber)' },
      { label: 'favoritaram', value: g.favoriteCount, color: 'var(--rose)' },
      { label: 'já jogaram', value: g.playedCount, color: 'var(--mint)' },
    ]
      .filter((s): s is { label: string; value: number; color: string } => s.value !== null)
      .map((s) => ({ ...s, value: s.value.toLocaleString('pt-BR') }));
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected typeLabel(type: string): string {
    return GAME_TYPE_LABELS[type as keyof typeof GAME_TYPE_LABELS] ?? type;
  }

  protected tagGroups(g: GameDetail) {
    return [
      { label: 'Categorias', items: g.categories },
      { label: 'Mecânicas', items: g.mechanics },
      { label: 'Temas', items: g.themes },
    ];
  }

  protected back(): void {
    this.location.back();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [game, lists] = await Promise.all([this.games.detail(this.gameId()), this.listsService.lists()]);
      this.game.set(game);
      this.lists.set(lists);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o jogo.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(list: List): Promise<void> {
    const g = this.game();
    if (!g || this.added().has(list.publicId)) return;

    this.adding.set(list.publicId);
    try {
      await this.listsService.addItem(list.publicId, { ludopediaId: g.ludopediaId });
      this.added.update((s) => new Set(s).add(list.publicId));
      this.feedback.success(`${g.name} está em ${list.name}.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar.');
    } finally {
      this.adding.set(null);
    }
  }
}
