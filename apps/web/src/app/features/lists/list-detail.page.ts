import { ChangeDetectionStrategy, Component, type OnDestroy, computed, inject, input, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
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
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { PageStateService } from '../../core/page-state.service';
import { Icon, type IconName } from '../../shared/icon';
import { Menu } from '../../shared/menu';
import { Cover, EmptyState, PageHead, Skeleton } from '../../shared/ui';

/**
 * Named for what the user sees: 'list' is rows with a thumbnail, 'cards' is a
 * grid of cover tiles.
 */
type ViewMode = 'list' | 'cards';

const PRIVACY: Record<Privacy, { label: string; icon: IconName }> = {
  public: { label: 'Público', icon: 'globe' },
  friends: { label: 'Amigos', icon: 'users' },
  nobody: { label: 'Só eu', icon: 'lock' },
};

/** Rows rendered per step of "Mostrar mais". */
const STEP = 48;

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
  limit: number;
  scrollY: number;
}

/**
 * The workbench: filter, sort, two layouts, selection mode and bulk actions.
 *
 * Loading: the list arrives over SSE and rows paint as they land. Filtering is
 * then client-side over the streamed rows (instant), and the screen grows with
 * "Mostrar mais" instead of paging — the data is already here, and on a phone
 * a button at the end of the scroll beats hunting for a pager.
 *
 * Selection is a mode, not a column of checkboxes: rows stay clean for reading,
 * and once you choose to select, tapping a row selects it and the actions rise
 * from the bottom where a thumb can reach them.
 */
@Component({
  selector: 'lt-list-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NgTemplateOutlet, Skeleton, EmptyState, Icon, Menu, Cover, PageHead],
  template: `
    @if (isOwner()) {
      <a routerLink="/colecao" class="back-link"><lt-icon name="arrow-left" [size]="16" /> Minhas listas</a>
    } @else {
      <button type="button" class="back-link" (click)="location.back()"><lt-icon name="arrow-left" [size]="16" /> Voltar</button>
    }

    <lt-page-head [eyebrow]="eyebrow()" [title]="list()?.name ?? 'Lista'" [subtitle]="countText()">
      @if (isOwner()) {
        <button type="button" class="btn" [class.btn-ink]="selecting()" [class.btn-ghost]="!selecting()" (click)="toggleSelecting()" [attr.aria-pressed]="selecting()">
          <lt-icon [name]="selecting() ? 'check' : 'select'" [size]="17" />
          {{ selecting() ? 'Concluir' : 'Selecionar' }}
        </button>
      }
      <lt-menu triggerClass="btn btn-ghost" label="Exportar lista" heading="Exportar a lista inteira">
        <span trigger class="inline-flex items-center gap-2"><lt-icon name="download" [size]="17" /> Exportar</span>
        <button type="button" class="menu-item" (click)="copyNames()" [disabled]="filtered().length === 0">
          <lt-icon name="copy" [size]="17" /> Copiar nomes <span class="meta ml-auto">WhatsApp</span>
        </button>
        <button type="button" class="menu-item" (click)="exportAll('names')"><lt-icon name="download" [size]="17" /> Baixar TXT</button>
        <button type="button" class="menu-item" (click)="exportAll('csv')"><lt-icon name="download" [size]="17" /> Baixar CSV</button>
        <button type="button" class="menu-item" (click)="exportAll('json')"><lt-icon name="download" [size]="17" /> Baixar JSON</button>
      </lt-menu>
    </lt-page-head>

    <!-- Controls -->
    <div class="rise mb-5 grid gap-3" style="--i: 3">
      <div class="search-box">
        <lt-icon name="search" [size]="18" />
        <label class="sr-only" for="filter">Filtrar por nome</label>
        <input id="filter" class="field" placeholder="Filtrar nesta lista…" [(ngModel)]="query" autocomplete="off" />
      </div>

      <!-- One row: a swipeable rail on a phone, wrapping on wider screens. -->
      <div class="rail rail-bleed items-center gap-2 sm:flex-wrap sm:overflow-visible">
        <label class="sr-only" for="sort">Ordenar por</label>
        <select id="sort" class="field field-sm w-auto" [ngModel]="sort()" (ngModelChange)="changeSort($event)">
          <option value="added_at">Mais recentes</option>
          <option value="name">Nome</option>
          <option value="year">Ano</option>
          <option value="type">Tipo</option>
        </select>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-icon"
          (click)="toggleDir()"
          [attr.aria-label]="dir() === 'asc' ? 'Ordem crescente. Inverter.' : 'Ordem decrescente. Inverter.'"
          [title]="dir() === 'asc' ? 'Crescente' : 'Decrescente'"
        >
          <lt-icon [name]="dir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="16" />
        </button>

        <!-- Loan state only exists for the owner, and only means something
             where the games actually live — the collection. -->
        @if (showLoanFilter()) {
          <div class="seg" role="group" aria-label="Situação de empréstimo">
            @for (opt of loanOptions; track opt.value) {
              <button type="button" [attr.aria-pressed]="loanFilter() === opt.value" (click)="changeLoanFilter(opt.value)">{{ opt.label }}</button>
            }
          </div>
        }

        <div class="seg ml-auto" role="group" aria-label="Modo de exibição">
          <button type="button" [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')" aria-label="Ver como lista" title="Lista">
            <lt-icon name="view-list" [size]="17" />
          </button>
          <button type="button" [attr.aria-pressed]="view() === 'cards'" (click)="view.set('cards')" aria-label="Ver como capas" title="Capas">
            <lt-icon name="view-cards" [size]="17" />
          </button>
        </div>
      </div>

      <!-- Only the types actually present, so it never offers a dead end. -->
      @if (availableTypes().length > 2) {
        <div class="rail rail-bleed" role="group" aria-label="Filtrar por tipo">
          @for (t of availableTypes(); track t.value) {
            <button type="button" class="chip" [attr.aria-pressed]="typeFilter() === t.value" (click)="changeTypeFilter(t.value)">
              {{ t.label }} <span class="count">{{ t.count }}</span>
            </button>
          }
        </div>
      }
    </div>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    @if (selecting()) {
      <p class="fade-in meta mb-3">Toque nos jogos para selecionar.</p>
    }

    <!-- One row's content, shared by the link (reading) and the toggle (selecting). -->
    <ng-template #rowBody let-item>
      <lt-cover class="h-14 w-14" [src]="item.game.thumbnail" />
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold text-ink">{{ item.game.name }}</span>
        <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="meta">{{ metaLine(item) }}</span>
          <span class="tag">{{ typeLabel(item.game.type) }}</span>
          <!-- Says who has it, not just that it's gone. -->
          @if (item.loan; as loan) {
            <span class="tag" [class.tag-amber]="loan.status === 'active'" [class.tag-brand]="loan.status === 'requested'">
              <lt-icon name="loan" [size]="11" />
              {{ loan.status === 'active' ? 'com ' + loan.counterpartLogin : 'pedido · ' + loan.counterpartLogin }}
            </span>
          }
        </span>
      </span>
    </ng-template>

    @if (loading()) {
      <div class="rows">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="row">
            <lt-skeleton height="3.5rem" width="3.5rem" />
            <div class="flex-1">
              <lt-skeleton height="0.95rem" width="45%" />
              <div class="mt-2"><lt-skeleton height="0.7rem" width="28%" /></div>
            </div>
          </div>
        }
      </div>
    } @else if (filtered().length === 0) {
      @if (isFiltering()) {
        <lt-empty title="Nada encontrado" message="Nenhum jogo desta lista bate com os filtros.">
          <button type="button" class="btn btn-ghost" (click)="clearFilters()">Limpar filtros</button>
        </lt-empty>
      } @else {
        <lt-empty title="Lista vazia" [message]="isOwner() ? 'Busque um jogo no catálogo e adicione a esta lista.' : 'Nenhum jogo visível para você aqui.'">
          @if (isOwner()) {
            <a routerLink="/buscar" class="btn btn-primary"><lt-icon name="search" [size]="17" /> Buscar jogos</a>
          }
        </lt-empty>
      }
    } @else if (view() === 'list') {
      <ul class="rows">
        @for (item of visible(); track item.publicId; let i = $index) {
          @if (selecting()) {
            <li
              class="row row-hover fade-in cursor-pointer"
              [style.--i]="i"
              [class.is-selected]="isSelected(item.publicId)"
              role="checkbox"
              tabindex="0"
              [attr.aria-checked]="isSelected(item.publicId)"
              [attr.aria-label]="item.game.name"
              (click)="toggle(item.publicId)"
              (keydown.enter)="toggle(item.publicId)"
              (keydown.space)="$event.preventDefault(); toggle(item.publicId)"
            >
              <span class="check" [class.on]="isSelected(item.publicId)"><lt-icon name="check" [size]="14" [strokeWidth]="3" /></span>
              <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: item }" />
            </li>
          } @else {
            <li class="row row-hover fade-in" [style.--i]="i">
              <a [routerLink]="['/jogos', item.game.publicId]" class="flex min-w-0 flex-1 items-center gap-3.5">
                <ng-container *ngTemplateOutlet="rowBody; context: { $implicit: item }" />
              </a>
              <!-- Per-row controls on wider screens; on a phone the same
                   actions live in selection mode, so rows stay tappable. -->
              @if (isOwner()) {
                <label class="sr-only" [attr.for]="'privacy-' + item.publicId">Privacidade de {{ item.game.name }}</label>
                <select
                  [attr.id]="'privacy-' + item.publicId"
                  class="field field-sm hidden w-auto sm:block"
                  [ngModel]="item.privacy"
                  (ngModelChange)="setPrivacy(item, $event)"
                >
                  @for (p of privacies; track p) {
                    <option [value]="p">{{ privacyLabel(p) }}</option>
                  }
                </select>
                <button
                  type="button"
                  class="btn btn-quiet btn-sm btn-icon hidden sm:inline-flex"
                  (click)="removeItem(item)"
                  [attr.aria-label]="'Remover ' + item.game.name"
                  title="Remover da lista"
                >
                  <lt-icon name="close" [size]="16" />
                </button>
              }
            </li>
          }
        }
      </ul>
    } @else {
      <ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        @for (item of visible(); track item.publicId; let i = $index) {
          <li class="fade-in" [style.--i]="i">
            @if (selecting()) {
              <button
                type="button"
                class="tile-card w-full text-left"
                [class.is-selected]="isSelected(item.publicId)"
                [attr.aria-pressed]="isSelected(item.publicId)"
                (click)="toggle(item.publicId)"
              >
                <span class="relative block">
                  <lt-cover class="aspect-square w-full" [src]="item.game.coverUrl ?? item.game.thumbnail" [iconSize]="32" />
                  <span class="check check-float" [class.on]="isSelected(item.publicId)"><lt-icon name="check" [size]="14" [strokeWidth]="3" /></span>
                </span>
                <span class="mt-2.5 block truncate text-sm font-semibold text-ink">{{ item.game.name }}</span>
                <span class="meta">{{ item.game.year ?? '—' }}</span>
              </button>
            } @else {
              <a [routerLink]="['/jogos', item.game.publicId]" class="tile-card block">
                <span class="relative block">
                  <lt-cover class="aspect-square w-full" [src]="item.game.coverUrl ?? item.game.thumbnail" [iconSize]="32" />
                  @if (item.loan; as loan) {
                    <span class="tag absolute top-2 left-2" [class.tag-amber]="loan.status === 'active'" [class.tag-brand]="loan.status === 'requested'">
                      <lt-icon name="loan" [size]="11" /> {{ loan.counterpartLogin }}
                    </span>
                  }
                </span>
                <span class="mt-2.5 block truncate text-sm font-semibold text-ink">{{ item.game.name }}</span>
                <span class="meta">{{ item.game.year ?? '—' }} · {{ typeLabel(item.game.type) }}</span>
              </a>
            }
          </li>
        }
      </ul>
    }

    @if (remaining() > 0) {
      <div class="mt-8 flex justify-center">
        <button type="button" class="btn btn-ghost" (click)="showMore()">
          Mostrar mais <span class="meta">{{ remaining() }} restantes</span>
        </button>
      </div>
    }

    <!-- Bulk dock. Owner-only, rises from the bottom while selecting. -->
    @if (isOwner() && selecting()) {
      <div class="dock" role="region" aria-label="Ações em massa">
        <div class="dock-inner">
          <span class="shrink-0 pl-2 pr-1 text-sm font-bold"><span class="stat">{{ selectedCount() }}</span><span class="hidden font-medium opacity-70 sm:inline"> {{ selectedCount() === 1 ? 'selecionado' : 'selecionados' }}</span></span>
          <div class="rail flex-1 items-center gap-1.5">
            <button type="button" class="dock-btn" (click)="allSelected() ? clearSelection() : selectAll()">
              {{ allSelected() ? 'Nenhum' : 'Todos' }}
            </button>
            <label class="sr-only" for="bulk-privacy">Mudar privacidade</label>
            <select id="bulk-privacy" class="dock-btn" [ngModel]="''" (ngModelChange)="bulkPrivacy($event)" [disabled]="busy() || selectedCount() === 0">
              <option value="">Privacidade</option>
              @for (p of privacies; track p) {
                <option [value]="p">{{ privacyLabel(p) }}</option>
              }
            </select>
            <label class="sr-only" for="bulk-target">Adicionar a outra lista</label>
            <select id="bulk-target" class="dock-btn" [ngModel]="''" (ngModelChange)="bulkCopyTo($event)" [disabled]="busy() || selectedCount() === 0">
              <option value="">Copiar para</option>
              @for (target of otherLists(); track target.publicId) {
                <option [value]="target.publicId">{{ target.name }}</option>
              }
            </select>
            <button type="button" class="dock-btn" (click)="bulkFavorite()" [disabled]="busy() || selectedCount() === 0">
              <lt-icon name="heart" [size]="15" /> Favoritar
            </button>
            <lt-menu triggerClass="dock-btn" label="Exportar seleção" heading="Exportar seleção" align="start">
              <span trigger class="inline-flex items-center gap-1.5"><lt-icon name="download" [size]="15" /> Exportar</span>
              <button type="button" class="menu-item" (click)="copyNames(true)" [disabled]="selectedCount() === 0"><lt-icon name="copy" [size]="17" /> Copiar nomes</button>
              <button type="button" class="menu-item" (click)="exportSelection('names')" [disabled]="selectedCount() === 0"><lt-icon name="download" [size]="17" /> TXT</button>
              <button type="button" class="menu-item" (click)="exportSelection('csv')" [disabled]="selectedCount() === 0"><lt-icon name="download" [size]="17" /> CSV</button>
              <button type="button" class="menu-item" (click)="exportSelection('json')" [disabled]="selectedCount() === 0"><lt-icon name="download" [size]="17" /> JSON</button>
            </lt-menu>
            <button type="button" class="dock-btn dock-btn-danger" (click)="bulkRemove()" [disabled]="busy() || selectedCount() === 0">
              <lt-icon name="trash" [size]="15" /> Remover
            </button>
          </div>
          <button type="button" class="dock-btn shrink-0 px-2.5!" (click)="toggleSelecting()" aria-label="Sair da seleção">
            <lt-icon name="close" [size]="17" />
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .check {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        border-radius: 999px;
        border: 2px solid var(--line-strong);
        background: var(--surface);
        color: transparent;
        transition:
          background-color var(--dur-fast) ease,
          border-color var(--dur-fast) ease,
          transform var(--dur-base) var(--ease-spring);
      }
      .check.on {
        background: var(--brand);
        border-color: var(--brand);
        color: #fff;
        transform: scale(1.08);
      }
      .check-float {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        box-shadow: var(--shadow-1);
      }

      .tile-card lt-cover {
        transition:
          transform var(--dur-base) var(--ease-out),
          box-shadow var(--dur-base) var(--ease-out);
      }
      @media (hover: hover) and (pointer: fine) {
        .tile-card:hover lt-cover {
          transform: translateY(-4px) rotate(-1deg);
          box-shadow:
            0 7px 0 rgb(30 22 48 / 0.14),
            var(--shadow-2);
        }
      }
      .tile-card.is-selected lt-cover {
        outline: 3px solid var(--brand);
        outline-offset: 2px;
      }
    `,
  ],
})
export class ListDetailPage implements OnDestroy {
  private readonly service = inject(ListsService);
  private readonly pageState = inject(PageStateService);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  protected readonly location = inject(Location);

  /** Bound from the route by withComponentInputBinding(). */
  readonly listId = input.required<string>();

  protected readonly privacies: Privacy[] = ['public', 'friends', 'nobody'];
  protected readonly loanOptions = [
    { value: 'all' as const, label: 'Todos' },
    { value: 'lent' as const, label: 'Emprestados' },
    { value: 'available' as const, label: 'Na estante' },
  ];

  protected readonly list = signal<List | null>(null);
  protected readonly allLists = signal<List[]>([]);
  protected readonly items = signal<ListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly streaming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly view = signal<ViewMode>('list');
  protected readonly sort = signal<ListItemSort>('added_at');
  protected readonly dir = signal<SortDirection>('desc');
  protected readonly loanFilter = signal<'all' | 'lent' | 'available'>('all');
  protected readonly typeFilter = signal<GameType | 'all'>('all');
  protected readonly query = signal('');
  protected readonly limit = signal(STEP);
  protected readonly selecting = signal(false);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Every game type, in display order (narrowed to what's present). */
  private readonly typeOrder: Array<{ value: GameType | 'all'; label: string }> = [
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

  /** Client-side filters over the streamed rows — instant, no round trip. */
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.typeFilter();
    return this.items().filter(
      (i) => (type === 'all' || i.game.type === type) && (!q || i.game.name.toLowerCase().includes(q)),
    );
  });

  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  protected readonly remaining = computed(() => Math.max(0, this.filtered().length - this.limit()));

  /** Which game types appear in this list, with how many of each. */
  protected readonly availableTypes = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.items()) counts.set(i.game.type, (counts.get(i.game.type) ?? 0) + 1);
    return this.typeOrder
      .filter((t) => t.value === 'all' || counts.has(t.value))
      .map((t) => ({ ...t, count: t.value === 'all' ? this.items().length : (counts.get(t.value) ?? 0) }));
  });

  protected readonly isFiltering = computed(() => this.query().trim() !== '' || this.typeFilter() !== 'all' || this.loanFilter() !== 'all');

  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(() => this.filtered().length > 0 && this.selected().size >= this.filtered().length);

  /** Copy targets: every list except the one we're looking at. */
  protected readonly otherLists = computed(() => this.allLists().filter((l) => l.publicId !== this.listId()));

  /**
   * Lending only applies to games you actually own, so the filter appears on
   * the collection and nowhere else.
   */
  protected readonly showLoanFilter = computed(() => this.list()?.kind === 'collection');

  /**
   * Ownership drives every mutation on this screen. `/lists` returns only the
   * caller's own lists, so a list found there is one we own; a list opened by
   * public id that isn't in that set resolves to null — someone else's. A
   * non-owner gets a read-only view.
   */
  protected readonly isOwner = computed(() => this.list() !== null);

  protected readonly eyebrow = computed(() => {
    const l = this.list();
    if (!l) return 'Lista compartilhada';
    return ({ collection: 'Sua coleção', wishlist: 'Lista de desejos', favorites: 'Favoritos', custom: 'Lista própria' } as const)[l.kind];
  });

  protected readonly countText = computed(() => {
    if (this.streaming()) return `Carregando… ${this.items().length} de ${this.total()}`;
    const n = this.filtered().length;
    const of = n !== this.items().length ? ` de ${this.items().length}` : '';
    return `${n}${of} ${n === 1 ? 'jogo' : 'jogos'}`;
  });

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
      limit: this.limit(),
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
    this.limit.set(s.limit ?? STEP);
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
    return PRIVACY[p].label;
  }

  protected metaLine(item: ListItem): string {
    const g = item.game;
    const parts: string[] = [];
    if (g.year) parts.push(String(g.year));
    if (g.minPlayers) parts.push(g.maxPlayers && g.maxPlayers !== g.minPlayers ? `${g.minPlayers}–${g.maxPlayers}p` : `${g.minPlayers}p`);
    if (g.playTimeMinutes) parts.push(`${g.playTimeMinutes}min`);
    return parts.join(' · ');
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

  protected toggleSelecting(): void {
    this.selecting.update((on) => !on);
    if (!this.selecting()) this.clearSelection();
  }

  protected selectAll(): void {
    this.selected.set(new Set(this.filtered().map((i) => i.publicId)));
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  protected clearFilters(): void {
    this.query.set('');
    this.typeFilter.set('all');
    if (this.loanFilter() !== 'all') this.changeLoanFilter('all');
  }

  protected showMore(): void {
    this.limit.update((n) => n + STEP);
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
    this.limit.set(STEP);
    this.clearSelection();
  }

  private async load(): Promise<void> {
    // A rapid sort change would otherwise leave two streams interleaving rows.
    this.abort?.abort();
    this.abort = new AbortController();

    this.loading.set(true);
    this.streaming.set(true);
    this.error.set(null);
    this.items.set([]);
    this.limit.set(STEP);
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
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível alterar a privacidade.');
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
      this.feedback.toast(`${item.game.name} saiu da lista.`);
    } catch (err) {
      this.items.set(snapshot);
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível remover o jogo.');
    }
  }

  protected async bulkRemove(): Promise<void> {
    const n = this.selectedCount();
    const ok = await this.feedback.confirm({
      title: `Remover ${n} ${n === 1 ? 'jogo' : 'jogos'} desta lista?`,
      message: 'Eles continuam nas suas outras listas.',
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (ok) await this.runBulk({ action: 'remove', itemIds: [...this.selected()] });
  }

  protected async bulkFavorite(): Promise<void> {
    await this.runBulk({ action: 'favorite', itemIds: [...this.selected()] });
  }

  protected async bulkPrivacy(privacy: Privacy | ''): Promise<void> {
    // The select's placeholder option fires an empty value; ignore it.
    if (!privacy) return;
    await this.runBulk({ action: 'set_privacy', itemIds: [...this.selected()], privacy });
  }

  protected async bulkCopyTo(targetListId: string): Promise<void> {
    if (!targetListId) return;
    await this.runBulk({ action: 'copy_to_list', itemIds: [...this.selected()], targetListId });
  }

  private async runBulk(input: BulkActionInput): Promise<void> {
    if (input.itemIds.length === 0) return;
    this.busy.set(true);
    try {
      const result = await this.service.bulk(this.listId(), input);
      const n = result.affected;
      switch (input.action) {
        case 'copy_to_list': {
          // Leaves this list untouched: report what happened instead of reloading.
          const target = this.allLists().find((l) => l.publicId === input.targetListId)?.name ?? 'a lista';
          this.feedback.success(
            result.skipped > 0 ? `${n} copiado(s) para ${target}. ${result.skipped} já estava(m) lá.` : `${n} copiado(s) para ${target}.`,
          );
          await this.refreshCounts();
          break;
        }
        case 'favorite':
          this.feedback.success(`${n} ${n === 1 ? 'jogo foi' : 'jogos foram'} para Favoritos.`);
          await this.refreshCounts();
          break;
        case 'set_privacy': {
          const ids = new Set(input.itemIds);
          this.items.update((current) => current.map((i) => (ids.has(i.publicId) ? { ...i, privacy: input.privacy } : i)));
          this.feedback.success(`Privacidade de ${n} ${n === 1 ? 'jogo' : 'jogos'}: ${PRIVACY[input.privacy].label}.`);
          break;
        }
        case 'remove':
          this.feedback.toast(`${n} ${n === 1 ? 'jogo removido' : 'jogos removidos'}.`);
          this.selecting.set(false);
          await this.load();
          break;
      }
      this.clearSelection();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      this.busy.set(false);
    }
  }

  private async refreshCounts(): Promise<void> {
    try {
      this.allLists.set(await this.service.lists());
    } catch {
      // Cosmetic only — the action already succeeded.
    }
  }

  protected async exportSelection(format: ExportFormat): Promise<void> {
    await this.runExport(format, [...this.selected()]);
  }

  protected async exportAll(format: ExportFormat): Promise<void> {
    await this.runExport(format);
  }

  private async runExport(format: ExportFormat, itemIds?: string[]): Promise<void> {
    try {
      await this.service.export(this.listId(), format, itemIds);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível exportar.');
    }
  }

  /**
   * Names straight to the clipboard — the WhatsApp path. Downloading a .txt
   * just to open it and copy from it is a detour nobody wants.
   */
  protected async copyNames(selectionOnly = false): Promise<void> {
    try {
      const ids = selectionOnly ? [...this.selected()] : undefined;
      const text = await this.service.namesText(this.listId(), ids);
      await navigator.clipboard.writeText(text.trim());
      this.feedback.success('Nomes copiados. É só colar no WhatsApp.');
    } catch (err) {
      // Clipboard access needs a secure context and can be blocked outright.
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível copiar. Use "Baixar TXT".');
    }
  }
}
