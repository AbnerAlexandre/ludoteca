import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { BulkActionInput, List, ListItem, ListItemSort, Privacy, SortDirection } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
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

    <header class="mb-5">
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

    <!-- Bulk bar. Appears only with a selection, so it never steals space. -->
    @if (selectedCount() > 0) {
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

        <button type="button" class="btn btn-sm bulk-btn" (click)="exportSelection('csv')">Exportar CSV</button>
        <button type="button" class="btn btn-sm bulk-btn" (click)="exportSelection('json')">Exportar JSON</button>
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
            <input
              type="checkbox"
              class="h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
              [checked]="isSelected(item.publicId)"
              (change)="toggle(item.publicId)"
              [attr.aria-label]="'Selecionar ' + item.game.name"
            />
            @if (item.game.thumbnail) {
              <img
                [src]="item.game.thumbnail"
                [alt]="''"
                class="h-16 w-16 shrink-0 rounded-lg object-cover"
                loading="lazy"
                style="background: var(--surface-sunken)"
              />
            } @else {
              <span class="grid h-16 w-16 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="22" /></span>
            }
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-strong">{{ item.game.name }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
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
              </p>
            </div>
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
          </li>
        }
      </ul>
    } @else {
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        @for (item of paged(); track item.publicId; let i = $index) {
          <li class="card animate-rise relative overflow-hidden" [style.animation-delay.ms]="i * 25">
            <input
              type="checkbox"
              class="absolute top-2 left-2 z-10 h-5 w-5 accent-[var(--color-brand-600)]"
              [checked]="isSelected(item.publicId)"
              (change)="toggle(item.publicId)"
              [attr.aria-label]="'Selecionar ' + item.game.name"
            />
            @if (item.game.coverUrl) {
              <img [src]="item.game.coverUrl" alt="" class="aspect-square w-full object-cover" loading="lazy" style="background: var(--surface-sunken)" />
            } @else {
              <span class="grid aspect-square w-full place-items-center text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="34" /></span>
            }
            <div class="p-2.5">
              <p class="truncate text-sm font-semibold text-strong">{{ item.game.name }}</p>
              <p class="stat mt-0.5 text-xs text-muted">{{ item.game.year ?? '—' }}</p>
            </div>
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
export class ListDetailPage {
  private readonly service = inject(ListsService);

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

  protected readonly view = signal<ViewMode>('list');
  protected readonly sort = signal<ListItemSort>('added_at');
  protected readonly dir = signal<SortDirection>('desc');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(24);
  protected readonly query = signal('');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Client-side filter over the streamed rows — no round trip to type. */
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((i) => i.game.name.toLowerCase().includes(q));
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

  private abort: AbortController | null = null;

  constructor() {
    // input.required is not readable in a field initializer, so kick the first
    // load off a microtask later, once the router has bound it.
    queueMicrotask(() => void this.load());
  }

  protected typeLabel(type: string): string {
    return (
      { board: 'Tabuleiro', cards: 'Cartas', expansion: 'Expansão', rpg: 'RPG', other: 'Outro' }[type] ?? type
    );
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
        { sort: this.sort(), dir: this.dir() },
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

  protected async exportSelection(format: 'csv' | 'json'): Promise<void> {
    try {
      await this.service.export(this.listId(), format, [...this.selected()]);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível exportar.');
    }
  }
}
