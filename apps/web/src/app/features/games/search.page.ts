import { ChangeDetectionStrategy, Component, type OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Game, List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { PageStateService } from '../../core/page-state.service';
import { GamesService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Cover, EmptyState, PageHead, Skeleton } from '../../shared/ui';
import { FEATURED_GAMES } from '../landing/featured-games';

/** What we keep so a Back navigation lands on the same results, not a blank form. */
interface SearchSnapshot {
  query: string;
  type: 'all' | 'base' | 'expansion';
  results: Game[];
  total: number;
  totalPages: number;
  page: number;
  searched: boolean;
  degraded: boolean;
  added: string[];
  scrollY: number;
}

const SEARCH_STATE_KEY = 'games/search';

/**
 * Catalogue search.
 *
 * One destination for the whole screen ("Adicionar em"), picked once at the
 * top, and a one-tap add on every result that turns into a confirmation in
 * place. The query lives in the URL (?q=), so the header's quick search lands
 * here and a search can be shared or bookmarked.
 */
@Component({
  selector: 'lt-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Skeleton, EmptyState, Icon, Cover, PageHead],
  template: `
    <lt-page-head eyebrow="Catálogo da Ludopedia" title="Buscar jogos" subtitle="Encontre um jogo e coloque direto na lista certa." />

    <form class="rise mb-4 flex flex-col gap-2 sm:flex-row" style="--i: 2" (ngSubmit)="search()" role="search">
      <div class="search-box flex-1">
        <lt-icon name="search" [size]="19" />
        <label class="sr-only" for="q">Nome do jogo</label>
        <input id="q" class="field h-12" [(ngModel)]="query" name="q" placeholder="Ex.: Terra Mystica" minlength="2" maxlength="80" autocomplete="off" enterkeyhint="search" />
      </div>
      <div class="flex gap-2">
        <label class="sr-only" for="type">Tipo</label>
        <select id="type" class="field h-12 flex-1 sm:w-auto" [(ngModel)]="type" name="type">
          <option value="all">Base e expansões</option>
          <option value="base">Só jogos base</option>
          <option value="expansion">Só expansões</option>
        </select>
        <button type="submit" class="btn btn-primary h-12 px-6" [disabled]="loading() || query().trim().length < 2">
          {{ loading() ? 'Buscando…' : 'Buscar' }}
        </button>
      </div>
    </form>

    <!-- The one destination for every "Adicionar" on this screen. -->
    @if (lists().length > 0) {
      <div class="rise mb-7 flex items-center gap-3" style="--i: 3">
        <span class="eyebrow shrink-0">Adicionar em</span>
        <div class="rail rail-bleed min-w-0 flex-1" role="radiogroup" aria-label="Lista de destino">
          @for (list of lists(); track list.publicId) {
            <button type="button" class="chip" role="radio" [attr.aria-checked]="targetList() === list.publicId" [attr.aria-pressed]="targetList() === list.publicId" (click)="targetList.set(list.publicId)">
              {{ list.name }}
            </button>
          }
        </div>
      </div>
    }

    <!-- Graceful degradation is user-facing: if Ludopedia is down we serve the
         local cache and say so, instead of pretending the list is complete. -->
    @if (degraded()) {
      <p role="status" class="notice notice-amber mb-4">A Ludopedia está fora do ar. Mostrando só os jogos já salvos por aqui.</p>
    }

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-4">{{ e }}</p>
    }

    @if (loading()) {
      <div class="rows">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="row">
            <lt-skeleton height="3.5rem" width="3.5rem" />
            <div class="flex-1"><lt-skeleton height="1rem" width="45%" /></div>
          </div>
        }
      </div>
    } @else if (searched() && results().length === 0) {
      <lt-empty title="Nenhum jogo encontrado" message="Tente outro nome, o nome original em inglês, ou confira a grafia." />
    } @else if (results().length > 0) {
      <p class="mb-3 meta">
        {{ total() }} {{ total() === 1 ? 'resultado' : 'resultados' }} · página {{ page() }} de {{ totalPages() }}
      </p>
      <ul class="rows">
        @for (game of results(); track game.publicId; let i = $index) {
          <li class="row row-hover fade-in" [style.--i]="i">
            <!-- Cover and title open the full sheet. -->
            <a [routerLink]="['/jogos', game.publicId]" class="flex min-w-0 flex-1 items-center gap-3.5">
              <lt-cover class="h-14 w-14" [src]="game.thumbnail" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-ink">{{ game.name }}</span>
                @if (game.originalName && game.originalName !== game.name) {
                  <span class="block truncate text-xs text-ink-3">{{ game.originalName }}</span>
                }
                <span class="meta">{{ game.year ?? 'ano desconhecido' }}</span>
              </span>
            </a>

            @if (isAdded(game)) {
              <span class="tag tag-mint shrink-0 pop-in" [attr.aria-label]="'Já está em ' + targetName()">
                <lt-icon name="check" [size]="12" [strokeWidth]="3" />
                <span class="hidden sm:inline">Em {{ targetName() }}</span>
              </span>
            } @else {
              <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0 max-sm:w-10 max-sm:px-0"
                (click)="add(game)"
                [disabled]="adding() === game.publicId || !targetList()"
                [attr.aria-label]="'Adicionar ' + game.name + ' em ' + targetName()"
              >
                <lt-icon name="plus" [size]="17" />
                <span class="hidden sm:inline">{{ adding() === game.publicId ? 'Adicionando…' : 'Adicionar' }}</span>
              </button>
            }
          </li>
        }
      </ul>

      @if (totalPages() > 1) {
        <nav class="mt-8 flex items-center justify-between gap-3" aria-label="Paginação">
          <button type="button" class="btn btn-ghost" [disabled]="page() === 1 || loading()" (click)="goTo(page() - 1)">
            <lt-icon name="arrow-left" [size]="17" /> Anterior
          </button>
          <span class="meta">{{ page() }} / {{ totalPages() }}</span>
          <button type="button" class="btn btn-ghost" [disabled]="page() === totalPages() || loading()" (click)="goTo(page() + 1)">
            Próxima <lt-icon name="arrow-right" [size]="17" />
          </button>
        </nav>
      }
    } @else {
      <!-- Before the first search: a few real titles to start from. -->
      <section class="fade-in" aria-labelledby="try-heading">
        <p id="try-heading" class="section-label eyebrow">Experimente</p>
        <div class="flex flex-wrap gap-2">
          @for (name of suggestions; track name) {
            <button type="button" class="chip" (click)="trySuggestion(name)">{{ name }}</button>
          }
        </div>
      </section>
    }
  `,
})
export class SearchPage implements OnDestroy {
  private readonly games = inject(GamesService);
  private readonly listsService = inject(ListsService);
  private readonly pageState = inject(PageStateService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  /** `?q=` — bound by withComponentInputBinding. */
  readonly q = input<string | undefined>(undefined);

  protected readonly query = signal('');
  protected readonly type = signal<'all' | 'base' | 'expansion'>('all');
  protected readonly results = signal<Game[]>([]);
  protected readonly lists = signal<List[]>([]);
  protected readonly targetList = signal('');
  protected readonly total = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly page = signal(1);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly degraded = signal(false);
  protected readonly adding = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** `${listId}:${ludopediaId}` pairs added this session — adding is idempotent. */
  private readonly added = signal<ReadonlySet<string>>(new Set());

  protected readonly suggestions = FEATURED_GAMES.slice(0, 10).map((g) => g.name);

  protected readonly targetName = computed(
    () => this.lists().find((l) => l.publicId === this.targetList())?.name ?? 'sua lista',
  );

  /** The query that produced the current results, so a URL echo doesn't re-run it. */
  private lastRunQuery = '';

  constructor() {
    // Restore only when we got here by Back/Forward, so a fresh visit from the
    // menu still starts clean. The current navigation is readable here because
    // the component is built during route activation.
    const restoring = this.router.getCurrentNavigation()?.trigger === 'popstate';
    void this.loadLists();
    if (restoring) {
      const snap = this.pageState.take<SearchSnapshot>(SEARCH_STATE_KEY);
      if (snap) this.restore(snap);
    }

    // A new ?q= (header quick search, a shared link) runs the search.
    effect(() => {
      const q = this.q()?.trim() ?? '';
      untracked(() => {
        if (q.length >= 2 && q !== this.lastRunQuery) {
          this.query.set(q);
          void this.search(false);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.pageState.save(SEARCH_STATE_KEY, {
      query: this.query(),
      type: this.type(),
      results: this.results(),
      total: this.total(),
      totalPages: this.totalPages(),
      page: this.page(),
      searched: this.searched(),
      degraded: this.degraded(),
      added: [...this.added()],
      scrollY: window.scrollY,
    } satisfies SearchSnapshot);
  }

  private restore(s: SearchSnapshot): void {
    this.query.set(s.query);
    this.type.set(s.type);
    this.results.set(s.results);
    this.total.set(s.total);
    this.totalPages.set(s.totalPages);
    this.page.set(s.page);
    this.searched.set(s.searched);
    this.degraded.set(s.degraded);
    this.added.set(new Set(s.added ?? []));
    if (s.searched) this.lastRunQuery = s.query.trim();
    // The rows rehydrate synchronously above, so the page is at its old height
    // by the next frame — jump back to where the user was.
    setTimeout(() => window.scrollTo(0, s.scrollY), 0);
  }

  private async loadLists(): Promise<void> {
    try {
      const lists = await this.listsService.lists();
      this.lists.set(lists);
      // Default the target to the collection — it's what people add to.
      this.targetList.set(lists.find((l) => l.kind === 'collection')?.publicId ?? lists[0]?.publicId ?? '');
    } catch {
      // Non-fatal: search still works, the user just can't add yet.
    }
  }

  protected isAdded(game: Game): boolean {
    return this.added().has(`${this.targetList()}:${game.ludopediaId}`);
  }

  protected trySuggestion(name: string): void {
    this.query.set(name);
    void this.search();
  }

  protected async search(updateUrl = true): Promise<void> {
    const q = this.query().trim();
    if (q.length < 2) return;
    this.page.set(1);
    this.lastRunQuery = q;
    if (updateUrl) void this.router.navigate(['/buscar'], { queryParams: { q }, replaceUrl: true });
    await this.run();
  }

  protected async goTo(page: number): Promise<void> {
    this.page.set(page);
    await this.run();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async run(): Promise<void> {
    const q = this.query().trim();
    if (q.length < 2) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.games.search(q, this.page(), 24, this.type());
      this.results.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
      this.degraded.set(!result.upstreamAvailable);
      this.searched.set(true);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível buscar agora.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(game: Game): Promise<void> {
    const listId = this.targetList();
    if (!listId) return;

    this.adding.set(game.publicId);
    try {
      await this.listsService.addItem(listId, { ludopediaId: game.ludopediaId });
      this.added.update((s) => new Set(s).add(`${listId}:${game.ludopediaId}`));
      this.feedback.success(`${game.name} foi para ${this.targetName()}.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar o jogo.');
    } finally {
      this.adding.set(null);
    }
  }
}
