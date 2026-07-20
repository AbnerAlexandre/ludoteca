import { ChangeDetectionStrategy, Component, type OnDestroy, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  GAME_TYPE_LABELS,
  type BulkActionInput,
  type ExportFormat,
  type GameType,
  type List,
  type ListItem,
  type ListItemSort,
  type Privacy,
  type SortDirection,
} from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
import { PageStateService } from '../../core/page-state.service';
import { Icon } from '../../shared/icon';
import { EmptyState, Skeleton } from '../../shared/ui';

/**
 * Named for what the user sees, not for the CSS underneath: 'list' is rows with
 * a thumbnail, 'cards' is a grid of cover tiles. The old names were 'card' and
 * 'grid', which had it backwards — "Cartões" rendered the rows.
 */
type ViewMode = 'list' | 'cards';

const PRIVACY_LABEL: Record<Privacy, string> = {
  public: 'Público',
  friends: 'Amigos',
  nobody: 'Só eu',
};

/** Kept so returning via Back rehydrates the list instead of re-streaming it. */
interface ListSnapshot {
  list: List | null;
  allLists: List[];
  items: ListItem[];
  total: number;
  view: ViewMode;
  sort: ListItemSort;
  dir: SortDirection;
  loanFilter: 'all' | 'lent' | 'available';
  typeFilter: GameType | 'all';
  query: string;
  page: number;
  pageSize: number;
  scrollY: number;
}

/**
 * The workbench: view toggle, page size, sorting, streaming load, multi-select
 * and bulk actions (spec §5.3).
 *
 * Loading strategy is the interesting part. The list arrives over SSE and rows
 * paint as they land, so the screen fills progressively instead of blocking on
 * the full set. Pagination is then applied client-side over the streamed rows —
 * the stream already delivered everything the filters allow, so re-fetching per
 * page would be a round trip for data we hold.
 */
@Component({
  selector: 'lt-list-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Skeleton, EmptyState, Icon],
  template: `
    <a routerLink="/colecao" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong">
      <lt-icon name="arrow-left" [size]="16" /> Minhas listas
    </a>

    <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl">{{ list()?.name ?? 'Lista' }}</h1>
        <p class="mt-1 text-sm text-muted">
          @if (streaming()) {
            Carregando…
            <span class="stat">{{ items().length }}</span> de <span class="stat">{{ total() }}</span>
          } @else {
            <span class="stat font-semibold text-strong">{{ filtered().length }}</span>
            {{ filtered().length === 1 ? 'jogo' : 'jogos' }}
          }
        </p>
      </div>

      <!-- Export the whole list. The same actions exist in the bulk bar for a
           selection; here they need no selection at all. -->
      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="btn btn-ghost btn-sm" (click)="copyNames()" [disabled]="filtered().length === 0">
          <lt-icon name="check" [size]="16" />
          {{ copied() ? 'Copiado!' : 'Copiar nomes' }}
        </button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="exportAll('names')" [disabled]="filtered().length === 0">
          <lt-icon name="download" [size]="16" />
          TXT
        </button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="exportAll('csv')" [disabled]="filtered().length === 0">
          <lt-icon name="download" [size]="16" />
          CSV
        </button>
        <button type="button" class="btn btn-ghost btn-sm" (click)="exportAll('json')" [disabled]="filtered().length === 0">
          <lt-icon name="download" [size]="16" />
          JSON
        </button>
      </div>
    </header>

    <!-- Controls. Wraps rather than scrolls sideways on a phone. -->
    <div class="panel mb-4 flex flex-wrap items-center gap-2 p-2.5">
      <label class="sr-only" for="filter">Filtrar por nome</label>
      <input id="filter" class="field flex-1" style="min-width: 10rem" placeholder="Filtrar nesta lista…" [(ngModel)]="query" />

      <label class="sr-only" for="sort">Ordenar por</label>
      <select id="sort" class="field w-auto" [ngModel]="sort()" (ngModelChange)="changeSort($event)">
        <option value="added_at">Adicionado</option>
        <option value="name">Nome</option>
        <option value="year">Ano</option>
        <option value="type">Tipo</option>
      </select>

      <button
        type="button"
        class="btn btn-ghost btn-sm btn-icon"
        (click)="toggleDir()"
        [attr.aria-label]="dir() === 'asc' ? 'Ordem crescente. Inverter.' : 'Ordem decrescente. Inverter.'"
      >
        <lt-icon [name]="dir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="17" />
      </button>

      <!-- Loan filter. Only the owner sees loan state at all, and it only means
           something where games actually live — the collection. -->
      @if (showLoanFilter()) {
        <label class="sr-only" for="loan">Situação de empréstimo</label>
        <select id="loan" class="field w-auto" [ngModel]="loanFilter()" (ngModelChange)="changeLoanFilter($event)">
          <option value="all">Todos</option>
          <option value="lent">Emprestados</option>
          <option value="available">Na estante</option>
        </select>
      }

      <label class="sr-only" for="pagesize">Itens por página</label>
      <select id="pagesize" class="field w-auto" [ngModel]="pageSize()" (ngModelChange)="changePageSize(+$event)">
        @for (size of pageSizes; track size) {
          <option [value]="size">{{ size }} / página</option>
        }
      </select>

      <!-- Each button is named after what it actually renders, and its icon
           mirrors that layout: rows with a leading thumbnail, or a tile grid. -->
      <div class="flex gap-1 rounded-xl p-1" style="background: var(--surface-sunken)" role="group" aria-label="Modo de exibição">
        <button
          type="button"
          class="btn btn-sm"
          [class.btn-primary]="view() === 'list'"
          [class.btn-quiet]="view() !== 'list'"
          (click)="view.set('list')"
          [attr.aria-pressed]="view() === 'list'"
          aria-label="Ver como lista"
        >
          <lt-icon name="view-list" [size]="17" />
          <span class="hidden sm:inline">Lista</span>
        </button>
        <button
          type="button"
          class="btn btn-sm"
          [class.btn-primary]="view() === 'cards'"
          [class.btn-quiet]="view() !== 'cards'"
          (click)="view.set('cards')"
          [attr.aria-pressed]="view() === 'cards'"
          aria-label="Ver como cartões"
        >
          <lt-icon name="view-cards" [size]="17" />
          <span class="hidden sm:inline">Cartões</span>
        </button>
      </div>
    </div>

    <!-- Type filter chips. Only shows the types actually present in the list, so
         it never offers a filter that would empty the screen. Hidden when
         everything is one type. -->
    @if (availableTypes().length > 2) {
      <div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
        @for (t of availableTypes(); track t.value) {
          <button type="button" class="chip" [class.chip-active]="typeFilter() === t.value" (click)="changeTypeFilter(t.value)" [attr.aria-pressed]="typeFilter() === t.value">
            {{ t.label }}
          </button>
        }
      </div>
    }

    <!-- Bulk bar. Owner-only, and only with a selection, so it never steals space. -->
    @if (isOwner() && selectedCount() > 0) {
      <div
        class="animate-rise sticky top-20 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl p-2.5"
        style="background: var(--color-brand-600); color: white"
        role="region"
        aria-label="Ações em massa"
      >
        <span class="px-1 text-sm font-semibold">
          <span class="stat">{{ selectedCount() }}</span> selecionado{{ selectedCount() === 1 ? '' : 's' }}
        </span>
        <div class="flex-1"></div>
        <button type="button" class="btn btn-sm bulk-btn" (click)="selectAll()">Selecionar todos</button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="clearSelection()">Limpar</button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="bulkFavorite()" [disabled]="busy()">Favoritar</button>

        <!-- Copy to another list. Firing on change keeps it one gesture, and the
             value resets so the same target can be picked again. -->
        <label class="sr-only" for="bulk-target">Adicionar a outra lista</label>
        <select id="bulk-target" class="field w-auto text-xs" [ngModel]="''" (ngModelChange)="bulkCopyTo($event)" [disabled]="busy()">
          <option value="">Adicionar a…</option>
          @for (target of otherLists(); track target.publicId) {
            <option [value]="target.publicId">{{ target.name }}</option>
          }
        </select>

        <button type="button" class="btn btn-sm bulk-btn" (click)="copyNames(true)">
          {{ copied() ? 'Copiado!' : 'Copiar nomes' }}
        </button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="exportSelection('names')">TXT</button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="exportSelection('csv')">CSV</button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="exportSelection('json')">JSON</button>
        <button type="button" class="btn btn-sm btn-danger" (click)="bulkRemove()" [disabled]="busy()">Remover</button>
      </div>
    }

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (notice(); as n) {
      <p
        role="status"
        class="mb-4 rounded-xl px-3 py-2 text-sm"
        style="background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success)"
      >
        {{ n }}
      </p>
    }

    @if (loading()) {
      <div class="grid gap-3">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="card flex items-center gap-4 p-3">
            <lt-skeleton height="4rem" width="4rem" />
            <div class="flex-1">
              <lt-skeleton height="1rem" width="40%" />
              <div class="mt-2"><lt-skeleton height="0.75rem" width="25%" /></div>
            </div>
          </div>
        }
      </div>
    } @else if (filtered().length === 0) {
      <lt-empty
        [title]="query() ? 'Nada encontrado' : 'Lista vazia'"
        [message]="query() ? 'Nenhum jogo desta lista bate com o filtro.' : 'Busque um jogo e adicione a esta lista.'"
      >
        <a routerLink="/buscar" class="btn btn-primary">Buscar jogos</a>
      </lt-empty>
    } @else if (view() === 'list') {
      <ul class="grid gap-3">
        @for (item of paged(); track item.publicId; let i = $index) {
          <li class="card animate-rise flex items-center gap-3 p-3" [style.animation-delay.ms]="i * 25">
            @if (isOwner()) {
              <input
                type="checkbox"
                class="h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
                [checked]="isSelected(item.publicId)"
                (change)="toggle(item.publicId)"
                [attr.aria-label]="'Selecionar ' + item.game.name"
              />
            }
            <!-- Cover and title open the game's full sheet. The checkbox and
                 the controls at the end stay outside the link. -->
            <a [routerLink]="['/jogos', item.game.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
              @if (item.game.thumbnail) {
                <img
                  [src]="item.game.thumbnail"
                  alt=""
                  class="h-16 w-16 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  style="background: var(--surface-sunken)"
                />
              } @else {
                <span class="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="22" /></span>
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-strong">{{ item.game.name }}</span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  @if (item.game.year) {
                    <span class="stat">{{ item.game.year }}</span>
                  }
                  @if (item.game.minPlayers) {
                    <span class="stat">{{ item.game.minPlayers }}–{{ item.game.maxPlayers }}p</span>
                  }
                  @if (item.game.playTimeMinutes) {
                    <span class="stat">{{ item.game.playTimeMinutes }}min</span>
                  }
                  <span class="chip">{{ typeLabel(item.game.type) }}</span>

                  <!-- Says who has it, not just that it's gone. -->
                  @if (item.loan; as loan) {
                    <span
                      class="chip"
                      [style.background]="'color-mix(in srgb, ' + loanColor(loan.status) + ' 14%, transparent)'"
                      [style.border-color]="'color-mix(in srgb, ' + loanColor(loan.status) + ' 35%, transparent)'"
                      [style.color]="loanColor(loan.status)"
                    >
                      <lt-icon name="loan" [size]="12" />
                      {{ loan.status === 'active' ? 'Com ' + loan.counterpartLogin : 'Pedido de ' + loan.counterpartLogin }}
                    </span>
                  }
                </span>
              </span>
            </a>
            @if (isOwner()) {
              <label class="sr-only" [attr.for]="'privacy-' + item.publicId">Privacidade de {{ item.game.name }}</label>
              <select
                [attr.id]="'privacy-' + item.publicId"
                class="field w-auto shrink-0 text-xs"
                [ngModel]="item.privacy"
                (ngModelChange)="setPrivacy(item, $event)"
              >
                @for (p of privacies; track p) {
                  <option [value]="p">{{ privacyLabel(p) }}</option>
                }
              </select>
              <button
                type="button"
                class="btn btn-quiet btn-sm btn-icon shrink-0"
                (click)="removeItem(item)"
                [attr.aria-label]="'Remover ' + item.game.name"
              >
                <lt-icon name="close" [size]="16" />
              </button>
            }
          </li>
        }
      </ul>
    } @else {
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        @for (item of paged(); track item.publicId; let i = $index) {
          <li class="card animate-rise relative overflow-hidden" [style.animation-delay.ms]="i * 25">
            @if (isOwner()) {
              <input
                type="checkbox"
                class="absolute top-2 left-2 z-10 h-5 w-5 accent-[var(--color-brand-600)]"
                [checked]="isSelected(item.publicId)"
                (change)="toggle(item.publicId)"
                [attr.aria-label]="'Selecionar ' + item.game.name"
              />
            }
            <a [routerLink]="['/jogos', item.game.publicId]" class="block">
              @if (item.game.coverUrl) {
                <img [src]="item.game.coverUrl" alt="" class="aspect-square w-full object-cover" loading="lazy" style="background: var(--surface-sunken)" />
              } @else {
                <span class="grid aspect-square w-full place-items-center text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="34" /></span>
              }
              <span class="block p-2.5">
                <span class="block truncate text-sm font-semibold text-strong">{{ item.game.name }}</span>
                <span class="stat mt-0.5 block text-xs text-muted">{{ item.game.year ?? '—' }}</span>
              </span>
            </a>
          </li>
        }
      </ul>
    }

    @if (totalPages() > 1) {
      <nav class="mt-6 flex items-center justify-center gap-2" aria-label="Paginação">
        <button type="button" class="btn btn-ghost btn-sm" [disabled]="page() === 1" (click)="page.set(page() - 1)">
          Anterior
        </button>
        <span class="stat px-2 text-sm text-muted">{{ page() }} / {{ totalPages() }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          [disabled]="page() === totalPages()"
          (click)="page.set(page() + 1)"
        >
          Próxima
        </button>
      </nav>
    }
  `,
  styles: [
    `
      /* Buttons sitting on the brand-coloured bulk bar need their own contrast. */
      .bulk-btn {
        background: rgb(255 255 255 / 0.16);
        color: #fff;
      }
      .bulk-btn:hover:not(:disabled) {
        background: rgb(255 255 255 / 0.28);
      }
    `,
  ],
})
export class ListDetailPage implements OnDestroy {
  private readonly service = inject(ListsService);
  private readonly pageState = inject(PageStateService);
  private readonly router = inject(Router);

  /** Bound from the route by withComponentInputBinding(). */
  readonly listId = input.required<string>();

  protected readonly pageSizes = [12, 24, 48, 96];
  protected readonly privacies: Privacy[] = ['public', 'friends', 'nobody'];

  protected readonly list = signal<List | null>(null);
  protected readonly allLists = signal<List[]>([]);
  protected readonly items = signal<ListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly streaming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly view = signal<ViewMode>('list');
  protected readonly sort = signal<ListItemSort>('added_at');
  protected readonly dir = signal<SortDirection>('desc');
  protected readonly loanFilter = signal<'all' | 'lent' | 'available'>('all');
  protected readonly typeFilter = signal<GameType | 'all'>('all');

  /** Every game type, for building the chip row (narrowed to what's present). */
  protected readonly typeFilterOptions: Array<{ value: GameType | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'board', label: 'Tabuleiro' },
    { value: 'cards', label: 'Cartas' },
    { value: 'rpg', label: 'RPG' },
    { value: 'party', label: 'Festa' },
    { value: 'dice', label: 'Dados' },
    { value: 'abstract', label: 'Abstrato' },
    { value: 'children', label: 'Infantil' },
    { value: 'expansion', label: 'Expansão' },
    { value: 'other', label: 'Outro' },
  ];
  protected readonly page = signal(1);
  protected readonly pageSize = signal(24);
  protected readonly query = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Client-side filters over the streamed rows — instant, no round trip. */
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    return this.items().filter(
      (i) =>
        (type === 'all' || i.game.type === type) &&
        (!q || i.game.name.toLowerCase().includes(q)),
    );
  });

  /** Which game types actually appear in this list, for the chip row. */
  protected readonly availableTypes = computed(() => {
    const present = new Set(this.items().map((i) => i.game.type));
    return this.typeFilterOptions.filter((t) => t.value === 'all' || present.has(t.value));
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize())),
  );

  protected readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  protected readonly selectedCount = computed(() => this.selected().size);

  /** Copy targets: every list except the one we're looking at. */
  protected readonly otherLists = computed(() => this.allLists().filter((l) => l.publicId !== this.listId()));

  /**
   * Lending only applies to games you actually own, so the filter appears on
   * the collection and nowhere else — a wishlist is a list of games you
   * explicitly do NOT have, and there is nothing to lend from it.
   */
  protected readonly showLoanFilter = computed(() => this.list()?.kind === 'collection');

  /**
   * Ownership drives every mutation on this screen. `/lists` returns only the
   * caller's own lists, so a list found there is one we own; a list opened by
   * public id that isn't in that set resolves to null — someone else's. A
   * non-owner gets a read-only view: no select, no bulk bar, no privacy, no
   * remove.
   */
  protected readonly isOwner = computed(() => this.list() !== null);

  private abort: AbortController | null = null;

  /** Capture the trigger synchronously — the navigation is live only now. */
  private readonly arrivedByBack = this.router.getCurrentNavigation()?.trigger === 'popstate';

  constructor() {
    // input.required is not readable in a field initializer, so kick the first
    // load off a microtask later, once the router has bound it.
    queueMicrotask(() => {
      const snap = this.arrivedByBack ? this.pageState.take<ListSnapshot>(this.stateKey()) : undefined;
      if (snap) this.restore(snap);
      else void this.load();
    });
  }

  ngOnDestroy(): void {
    // Stop any in-flight stream so it can't paint into a dead view…
    this.abort?.abort();
    // …then stash the screen so Back returns to exactly this state.
    this.pageState.save(this.stateKey(), {
      list: this.list(),
      allLists: this.allLists(),
      items: this.items(),
      total: this.total(),
      view: this.view(),
      sort: this.sort(),
      dir: this.dir(),
      loanFilter: this.loanFilter(),
      typeFilter: this.typeFilter(),
      query: this.query(),
      page: this.page(),
      pageSize: this.pageSize(),
      scrollY: window.scrollY,
    } satisfies ListSnapshot);
  }

  private stateKey(): string {
    return `lists/${this.listId()}`;
  }

  private restore(s: ListSnapshot): void {
    this.list.set(s.list);
    this.allLists.set(s.allLists);
    this.items.set(s.items);
    this.total.set(s.total);
    this.view.set(s.view);
    this.sort.set(s.sort);
    this.dir.set(s.dir);
    this.loanFilter.set(s.loanFilter);
    this.typeFilter.set(s.typeFilter);
    this.query.set(s.query);
    this.pageSize.set(s.pageSize);
    this.page.set(s.page);
    this.loading.set(false);
    this.streaming.set(false);
    // Rows rehydrate synchronously, so the page regains its height immediately —
    // jump back to where the user was reading.
    setTimeout(() => window.scrollTo(0, s.scrollY), 0);
  }

  protected typeLabel(type: string): string {
    return GAME_TYPE_LABELS[type as keyof typeof GAME_TYPE_LABELS] ?? type;
  }

  protected privacyLabel(p: Privacy): string {
    return PRIVACY_LABEL[p];
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected toggle(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.filtered().map((i) => i.publicId)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected changeSort(sort: ListItemSort): void {
    this.sort.set(sort);
    void this.load();
  }

  protected toggleDir(): void {
    this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    void this.load();
  }

  protected changeLoanFilter(value: 'all' | 'lent' | 'available'): void {
    this.loanFilter.set(value);
    // Server-side: only it knows the loan table, so this is a fresh stream.
    void this.load();
  }

  protected changeTypeFilter(value: GameType | 'all'): void {
    // Client-side over the already-streamed rows, so it's instant.
    this.typeFilter.set(value);
    this.page.set(1);
    this.clearSelection();
  }

  protected loanColor(status: 'requested' | 'active'): string {
    return status === 'active' ? 'var(--color-warning)' : 'var(--color-brand-500)';
  }

  protected changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  private async load(): Promise<void> {
    // A rapid sort change would otherwise leave two streams interleaving rows.
    this.abort?.abort();
    this.abort = new AbortController();

    this.loading.set(true);
    this.streaming.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.items.set([]);
    this.page.set(1);
    this.clearSelection();

    try {
      const lists = await this.service.lists();
      this.allLists.set(lists);
      this.list.set(lists.find((l) => l.publicId === this.listId()) ?? null);

      await this.service.streamItems(
        this.listId(),
        { sort: this.sort(), dir: this.dir(), loan: this.loanFilter() },
        {
          onMeta: (meta) => {
            this.total.set(meta.total);
            // Drop the skeletons as soon as we know the shape; rows fill in next.
            this.loading.set(false);
          },
          onItems: (batch) => this.items.update((current) => [...current, ...batch]),
          onDone: () => this.streaming.set(false),
        },
        this.abort.signal,
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar a lista.');
    } finally {
      this.loading.set(false);
      this.streaming.set(false);
    }
  }

  protected async setPrivacy(item: ListItem, privacy: Privacy): Promise<void> {
    const previous = item.privacy;
    // Optimistic: privacy changes are the kind of toggle people flip in bursts.
    this.patchItem(item.publicId, { privacy });
    try {
      await this.service.setPrivacy(this.listId(), item.publicId, privacy);
    } catch (err) {
      this.patchItem(item.publicId, { privacy: previous });
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível alterar a privacidade.');
    }
  }

  private patchItem(id: string, patch: Partial<ListItem>): void {
    this.items.update((current) => current.map((i) => (i.publicId === id ? { ...i, ...patch } : i)));
  }

  protected async removeItem(item: ListItem): Promise<void> {
    const snapshot = this.items();
    this.items.update((current) => current.filter((i) => i.publicId !== item.publicId));
    try {
      await this.service.removeItem(this.listId(), item.publicId);
    } catch (err) {
      this.items.set(snapshot);
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível remover o jogo.');
    }
  }

  protected async bulkRemove(): Promise<void> {
    await this.runBulk({ action: 'remove', itemIds: [...this.selected()] });
  }

  protected async bulkFavorite(): Promise<void> {
    await this.runBulk({ action: 'favorite', itemIds: [...this.selected()] });
  }

  protected async bulkCopyTo(targetListId: string): Promise<void> {
    // The select's placeholder option fires an empty value; ignore it.
    if (!targetListId) return;
    await this.runBulk({ action: 'copy_to_list', itemIds: [...this.selected()], targetListId });
  }

  private async runBulk(input: BulkActionInput): Promise<void> {
    if (input.itemIds.length === 0) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await this.service.bulk(this.listId(), input);
      this.clearSelection();
      // copy_to_list leaves this list untouched, so reloading would say nothing.
      // Report what happened instead — including items already in the target.
      if (input.action === 'copy_to_list') {
        const target = this.allLists().find((l) => l.publicId === input.targetListId)?.name ?? 'a lista';
        this.notice.set(
          result.skipped > 0
            ? `${result.affected} adicionado(s) a ${target}. ${result.skipped} já estava(m) lá.`
            : `${result.affected} adicionado(s) a ${target}.`,
        );
        await this.refreshCounts();
      } else {
        await this.load();
      }
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      this.busy.set(false);
    }
  }

  private async refreshCounts(): Promise<void> {
    try {
      this.allLists.set(await this.service.lists());
    } catch {
      // Cosmetic only — the copy already succeeded.
    }
  }

  protected async exportSelection(format: ExportFormat): Promise<void> {
    await this.runExport(format, [...this.selected()]);
  }

  protected async exportAll(format: ExportFormat): Promise<void> {
    await this.runExport(format);
  }

  private async runExport(format: ExportFormat, itemIds?: string[]): Promise<void> {
    this.error.set(null);
    try {
      await this.service.export(this.listId(), format, itemIds);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível exportar.');
    }
  }

  /**
   * Names straight to the clipboard — the WhatsApp path. Downloading a .txt
   * just to open it and copy from it is a detour nobody wants.
   */
  protected async copyNames(selectionOnly = false): Promise<void> {
    this.error.set(null);
    try {
      const ids = selectionOnly ? [...this.selected()] : undefined;
      const text = await this.service.namesText(this.listId(), ids);
      await navigator.clipboard.writeText(text.trim());
      this.copied.set(true);
      // Revert the label so the button doesn't read "Copiado!" forever.
      setTimeout(() => this.copied.set(false), 2000);
    } catch (err) {
      // Clipboard access needs a secure context and can be blocked outright.
      this.error.set(
        err instanceof ApiFailure ? err.message : 'Não foi possível copiar. Use o botão TXT para baixar.',
      );
    }
  }
}
