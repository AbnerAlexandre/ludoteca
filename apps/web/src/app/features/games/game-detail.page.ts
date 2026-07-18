import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import type { GameDetail, List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
import { GamesService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Skeleton } from '../../shared/ui';
import { featuredById } from '../landing/featured-games';

const TYPE_LABEL: Record<string, string> = {
  board: 'Tabuleiro',
  cards: 'Cartas',
  expansion: 'Expansão',
  rpg: 'RPG',
  other: 'Outro',
};

/**
 * The full sheet for one game, from the Ludopedia cache.
 *
 * On what's shown and what isn't: Ludopedia's API exposes no rating and no
 * image gallery. `/jogos/{id}/notas` and `/jogos/{id}/imagens` are documented
 * as "não implementado" and really do return placeholder strings. What it does
 * give is the cover plus community counters — how many people own, want,
 * favourite and have played it. Those are presented as popularity, never
 * dressed up as a score we don't have.
 */
@Component({
  selector: 'lt-game-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, Skeleton],
  template: `
    <button type="button" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong" (click)="back()">
      <lt-icon name="arrow-left" [size]="16" /> Voltar
    </button>

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <lt-skeleton height="18rem" />
        <div class="space-y-3">
          <lt-skeleton height="2rem" width="55%" />
          <lt-skeleton height="1rem" width="35%" />
          <lt-skeleton height="6rem" />
        </div>
      </div>
    } @else if (game(); as g) {
      <article class="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <!-- Cover column -->
        <div>
          @if (g.coverUrl || g.thumbnail) {
            <img
              [src]="g.coverUrl ?? g.thumbnail"
              [alt]="'Capa de ' + g.name"
              class="w-full rounded-2xl object-cover"
              style="background: var(--surface-sunken)"
            />
          } @else {
            <div class="grid aspect-square w-full place-items-center rounded-2xl text-muted" style="background: var(--surface-sunken)">
              <lt-icon name="dice" [size]="48" />
            </div>
          }

          <div class="mt-3 grid gap-2">
            <!-- Buy: Ludopedia's own game page carries the store listings. The
                 API exposes no direct purchase URL, so this is the honest link.
                 rel=noopener because target=_blank without it hands the new tab
                 a window.opener handle back to us. -->
            @if (g.link) {
              <a [href]="g.link" target="_blank" rel="noopener noreferrer" class="btn btn-primary w-full">
                <lt-icon name="cart" [size]="18" />
                Comprar na Ludopedia
                <lt-icon name="external-link" [size]="14" />
              </a>
            }

            <form class="flex gap-2" (ngSubmit)="add()">
              <label class="sr-only" for="target">Lista de destino</label>
              <select id="target" class="field flex-1 text-sm" [(ngModel)]="targetList" name="target">
                @for (list of lists(); track list.publicId) {
                  <option [value]="list.publicId">{{ list.name }}</option>
                }
              </select>
              <button type="submit" class="btn btn-ghost" [disabled]="adding() || !targetList()">
                <lt-icon name="plus" [size]="17" />
                {{ adding() ? '…' : 'Adicionar' }}
              </button>
            </form>

            @if (notice(); as n) {
              <p role="status" class="rounded-xl px-3 py-2 text-xs" style="background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)">
                {{ n }}
              </p>
            }
          </div>
        </div>

        <!-- Detail column -->
        <div class="min-w-0">
          <h1 class="text-4xl">{{ g.name }}</h1>
          @if (g.originalName && g.originalName !== g.name) {
            <p class="mt-1 text-sm text-muted">{{ g.originalName }}</p>
          }

          <div class="mt-3 flex flex-wrap gap-1.5">
            <span class="chip chip-active">{{ typeLabel(g.type) }}</span>
            @for (category of g.categories; track category) {
              <span class="chip">{{ category }}</span>
            }
          </div>

          <!-- Synopsis, when we have one for this game. Ludopedia's API exposes
               no description, so it comes from our featured-games data. -->
          @if (description(); as text) {
            <p class="mt-4 max-w-2xl leading-relaxed text-body">{{ text }}</p>
          }

          <!-- Vital stats: the numbers you check before putting it on the table. -->
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

          <!-- Popularity, labelled as what it is. Ludopedia has no rating. -->
          @if (hasCommunityStats()) {
            <section class="mt-6" aria-labelledby="pop-heading">
              <h2 id="pop-heading" class="mb-1 text-lg">Na comunidade</h2>
              <p class="mb-3 text-xs text-muted">Quantas pessoas na Ludopedia marcaram este jogo.</p>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                @for (stat of communityStats(); track stat.label) {
                  <div class="panel p-3">
                    <p class="stat text-xl font-bold" [style.color]="stat.color">{{ stat.value }}</p>
                    <p class="text-xs text-muted">{{ stat.label }}</p>
                  </div>
                }
              </div>
            </section>
          }

          @if (g.mechanics.length) {
            <section class="mt-6" aria-labelledby="mech-heading">
              <h2 id="mech-heading" class="mb-2 text-lg">Mecânicas</h2>
              <div class="flex flex-wrap gap-1.5">
                @for (mechanic of g.mechanics; track mechanic) {
                  <span class="chip">{{ mechanic }}</span>
                }
              </div>
            </section>
          }

          @if (g.themes.length) {
            <section class="mt-6" aria-labelledby="theme-heading">
              <h2 id="theme-heading" class="mb-2 text-lg">Temas</h2>
              <div class="flex flex-wrap gap-1.5">
                @for (theme of g.themes; track theme) {
                  <span class="chip">{{ theme }}</span>
                }
              </div>
            </section>
          }

          <div class="mt-6 grid gap-6 sm:grid-cols-2">
            @if (g.designers.length) {
              <section aria-labelledby="designer-heading">
                <h2 id="designer-heading" class="mb-2 text-lg">Designers</h2>
                <ul class="text-sm text-body">
                  @for (person of g.designers; track person) {
                    <li>{{ person }}</li>
                  }
                </ul>
              </section>
            }
            @if (g.artists.length) {
              <section aria-labelledby="artist-heading">
                <h2 id="artist-heading" class="mb-2 text-lg">Artistas</h2>
                <ul class="text-sm text-body">
                  @for (person of g.artists; track person) {
                    <li>{{ person }}</li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>
      </article>
    }
  `,
})
export class GameDetailPage {
  private readonly games = inject(GamesService);
  private readonly listsService = inject(ListsService);
  private readonly location = inject(Location);

  readonly gameId = input.required<string>();

  protected readonly game = signal<GameDetail | null>(null);
  protected readonly lists = signal<List[]>([]);
  protected readonly targetList = signal('');
  protected readonly loading = signal(true);
  protected readonly adding = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  /** Synopsis for the featured games — Ludopedia's API provides none. */
  protected readonly description = computed(() => {
    const g = this.game();
    return g ? (featuredById(g.ludopediaId)?.description ?? null) : null;
  });

  /** Only the facts upstream actually knows — a null field is left out entirely. */
  protected readonly facts = computed(() => {
    const g = this.game();
    if (!g) return [];
    const rows: Array<{ icon: 'calendar' | 'users' | 'clock' | 'star'; label: string; value: string }> = [];
    if (g.year) rows.push({ icon: 'calendar', label: 'Ano', value: String(g.year) });
    if (g.minPlayers)
      rows.push({
        icon: 'users',
        label: 'Jogadores',
        value: g.maxPlayers && g.maxPlayers !== g.minPlayers ? `${g.minPlayers}–${g.maxPlayers}` : String(g.minPlayers),
      });
    if (g.playTimeMinutes) rows.push({ icon: 'clock', label: 'Duração', value: `${g.playTimeMinutes} min` });
    if (g.minAge) rows.push({ icon: 'star', label: 'Idade', value: `${g.minAge}+` });
    return rows;
  });

  protected readonly communityStats = computed(() => {
    const g = this.game();
    if (!g) return [];
    return [
      { label: 'têm', value: g.ownedCount, color: 'var(--color-brand-500)' },
      { label: 'querem', value: g.wantedCount, color: 'var(--color-warning)' },
      { label: 'favoritaram', value: g.favoriteCount, color: 'var(--color-danger)' },
      { label: 'já jogaram', value: g.playedCount, color: 'var(--color-success)' },
    ]
      .filter((s): s is { label: string; value: number; color: string } => s.value !== null)
      .map((s) => ({ ...s, value: s.value.toLocaleString('pt-BR') }));
  });

  protected readonly hasCommunityStats = computed(() => this.communityStats().length > 0);

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected typeLabel(type: string): string {
    return TYPE_LABEL[type] ?? type;
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
      this.targetList.set(lists.find((l) => l.kind === 'collection')?.publicId ?? lists[0]?.publicId ?? '');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o jogo.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(): Promise<void> {
    const g = this.game();
    const listId = this.targetList();
    if (!g || !listId) return;

    this.adding.set(true);
    this.error.set(null);
    try {
      await this.listsService.addItem(listId, { ludopediaId: g.ludopediaId });
      const name = this.lists().find((l) => l.publicId === listId)?.name ?? 'sua lista';
      this.notice.set(`Adicionado a ${name}.`);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar.');
    } finally {
      this.adding.set(false);
    }
  }
}
