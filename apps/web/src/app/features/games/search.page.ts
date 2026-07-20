import { ChangeDetectionStrategy, Component, type OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Game, List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
import { PageStateService } from '../../core/page-state.service';
import { GamesService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, Skeleton } from '../../shared/ui';

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
  scrollY: number;
}

const SEARCH_STATE_KEY = 'games/search';

@Component({
  selector: 'lt-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Skeleton, EmptyState, Icon],
  template: `
    <header class="mb-5">
      <h1 class="text-3xl">Buscar jogos</h1>
      <p class="mt-1 text-sm text-muted">Catálogo da Ludopedia. Adicione direto em qualquer lista.</p>
    </header>

    <form class="panel mb-4 flex flex-wrap gap-2 p-2.5" (ngSubmit)="search()">
      <label class="sr-only" for="q">Nome do jogo</label>
      <input
        id="q"
        class="field flex-1"
        style="min-width: 12rem"
        [(ngModel)]="query"
        name="q"
        placeholder="Ex.: Terra Mystica"
        minlength="2"
        maxlength="80"
      />
      <label class="sr-only" for="type">Tipo</label>
      <select id="type" class="field w-auto" [(ngModel)]="type" name="type">
        <option value="all">Todos</option>
        <option value="base">Jogos base</option>
        <option value="expansion">Expansões</option>
      </select>
      <button type="submit" class="btn btn-primary" [disabled]="loading() || query().trim().length < 2">
        {{ loading() ? 'Buscando…' : 'Buscar' }}
      </button>
    </form>

    <!-- Graceful degradation is user-facing: if Ludopedia is down we serve the
         local cache and say so, instead of pretending the list is complete. -->
    @if (degraded()) {
      <p
        role="status"
        class="mb-4 rounded-xl px-3 py-2 text-sm"
        style="background: color-mix(in srgb, var(--color-warning) 14%, transparent); color: var(--color-warning)"
      >
        A Ludopedia está fora do ar. Mostrando só os jogos já salvos por aqui.
      </p>
    }

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (notice(); as n) {
      <p role="status" class="mb-4 rounded-xl px-3 py-2 text-sm" style="background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)">
        {{ n }}
      </p>
    }

    @if (loading()) {
      <ul class="grid gap-3">
        @for (i of [1, 2, 3, 4]; track i) {
          <li class="card flex items-center gap-4 p-3">
            <lt-skeleton height="4rem" width="4rem" />
            <div class="flex-1"><lt-skeleton height="1rem" width="45%" /></div>
          </li>
        }
      </ul>
    } @else if (searched() && results().length === 0) {
      <lt-empty icon="search" title="Nenhum jogo encontrado" message="Tente outro nome ou verifique a grafia." />
    } @else if (results().length > 0) {
      <p class="mb-3 text-sm text-muted">
        <span class="stat font-semibold text-strong">{{ total() }}</span> resultado{{ total() === 1 ? '' : 's' }}
      </p>
      <ul class="grid gap-3">
        @for (game of results(); track game.publicId; let i = $index) {
          <li class="card animate-rise flex flex-wrap items-center gap-3 p-3" [style.animation-delay.ms]="i * 25">
            <!-- The cover and title open the full sheet. -->
            <a [routerLink]="['/jogos', game.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
              @if (game.thumbnail) {
                <img [src]="game.thumbnail" alt="" class="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" style="background: var(--surface-sunken)" />
              } @else {
                <span class="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="22" /></span>
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-strong">{{ game.name }}</span>
                @if (game.originalName && game.originalName !== game.name) {
                  <span class="block truncate text-xs text-muted">{{ game.originalName }}</span>
                }
                <span class="stat mt-0.5 block text-xs text-muted">{{ game.year ?? '—' }}</span>
              </span>
            </a>

            <label class="sr-only" [attr.for]="'list-' + game.publicId">Lista de destino</label>
            <select [attr.id]="'list-' + game.publicId" class="field w-auto shrink-0 text-sm" [(ngModel)]="targetList" [name]="'list-' + game.publicId">
              @for (list of lists(); track list.publicId) {
                <option [value]="list.publicId">{{ list.name }}</option>
              }
            </select>
            <button type="button" class="btn btn-primary btn-sm shrink-0" (click)="add(game)" [disabled]="adding() === game.publicId">
              {{ adding() === game.publicId ? 'Adicionando…' : 'Adicionar' }}
            </button>
          </li>
        }
      </ul>

      @if (totalPages() > 1) {
        <nav class="mt-6 flex items-center justify-center gap-2" aria-label="Paginação">
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="page() === 1" (click)="goTo(page() - 1)">Anterior</button>
          <span class="stat px-2 text-sm text-muted">{{ page() }} / {{ totalPages() }}</span>
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="page() === totalPages()" (click)="goTo(page() + 1)">Próxima</button>
        </nav>
      }
    } @else {
      <lt-empty icon="search" title="Procure um jogo" message="Digite o nome de um jogo para buscar no catálogo da Ludopedia." />
    }
  `,
})
export class SearchPage implements OnDestroy {
  private readonly games = inject(GamesService);
  private readonly listsService = inject(ListsService);
  private readonly pageState = inject(PageStateService);
  private readonly router = inject(Router);

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
  protected readonly notice = signal<string | null>(null);

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

  protected async search(): Promise<void> {
    this.page.set(1);
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
    this.notice.set(null);
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
    this.error.set(null);
    try {
      await this.listsService.addItem(listId, { ludopediaId: game.ludopediaId });
      const listName = this.lists().find((l) => l.publicId === listId)?.name ?? 'sua lista';
      this.notice.set(`${game.name} foi para ${listName}.`);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível adicionar o jogo.');
    } finally {
      this.adding.set(null);
    }
  }
}
