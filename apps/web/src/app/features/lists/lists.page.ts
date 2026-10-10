import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { Icon } from '../../shared/icon';
import { Menu } from '../../shared/menu';
import { Sheet } from '../../shared/sheet';
import { EmptyState, PageHead, Skeleton } from '../../shared/ui';

/**
 * Each list is a tile with a monogram on solid colour — the same piece the logo
 * is built from. The colours are chrome, deliberately not seat colours: a seat
 * colour always means "a person".
 */
const KIND_META: Record<List['kind'], { label: string; blurb: string; color: string; ink: string }> = {
  collection: { label: 'Coleção', blurb: 'O que você tem na estante', color: 'var(--brand)', ink: '#fff' },
  wishlist: { label: 'Desejos', blurb: 'O que você quer comprar', color: 'var(--amber)', ink: '#2a1b00' },
  favorites: { label: 'Favoritos', blurb: 'Os que você sempre leva', color: 'var(--rose)', ink: '#fff' },
  custom: { label: 'Lista', blurb: 'Lista personalizada', color: 'var(--teal)', ink: '#fff' },
};

@Component({
  selector: 'lt-lists',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Skeleton, EmptyState, Icon, Menu, Sheet, PageHead],
  template: `
    <lt-page-head eyebrow="Sua ludoteca" title="Minhas listas" [subtitle]="subtitle()">
      <button type="button" class="btn btn-primary" (click)="startCreate()">
        <lt-icon name="plus" [size]="18" /> Nova lista
      </button>
    </lt-page-head>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div class="card p-5">
            <lt-skeleton height="4rem" width="3.5rem" />
            <div class="mt-5"><lt-skeleton height="1.25rem" width="55%" /></div>
            <div class="mt-2"><lt-skeleton height="0.8rem" width="75%" /></div>
          </div>
        }
      </div>
    } @else if (lists().length === 0) {
      <lt-empty title="Nenhuma lista ainda" message="Crie uma lista para começar a organizar seus jogos.">
        <button type="button" class="btn btn-primary" (click)="startCreate()">Nova lista</button>
      </lt-empty>
    } @else {
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (list of lists(); track list.publicId; let i = $index) {
          <li class="rise relative" [style.--i]="i">
            <!-- Phone: a compact row (tile · name · count). Wider: a standing tile card. -->
            <a
              [routerLink]="['/listas', list.publicId]"
              class="card card-link group grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 p-3.5 sm:flex sm:flex-col sm:items-stretch sm:p-5"
              [class]="list.isSystem ? '' : 'pr-14 sm:pr-5'"
            >
              <span class="tile h-14 w-12 text-[1.7rem] sm:h-16 sm:w-14 sm:text-[2rem]" [style.background]="meta(list).color" [style.color]="meta(list).ink" aria-hidden="true">
                {{ monogram(list) }}
              </span>
              <span class="min-w-0 sm:mt-5">
                <span class="eyebrow block">{{ meta(list).label }}</span>
                <span class="mt-1 block truncate font-display text-[1.2rem] font-bold tracking-tight text-ink sm:text-[1.35rem]">{{ list.name }}</span>
                <span class="mt-0.5 hidden text-sm text-ink-3 sm:block">{{ meta(list).blurb }}</span>
              </span>
              <span class="flex items-end justify-between sm:mt-5 sm:border-t sm:border-line sm:pt-4">
                <span>
                  <span class="num text-[1.75rem] text-ink">{{ list.itemCount }}</span>
                  <span class="ml-1.5 hidden text-sm text-ink-3 sm:inline">{{ list.itemCount === 1 ? 'jogo' : 'jogos' }}</span>
                </span>
                <span class="arrow hidden text-ink-3 sm:inline"><lt-icon name="arrow-right" [size]="20" /></span>
              </span>
            </a>

            <!-- Only custom lists can go. The seeded three are structural: other
                 features route to them by kind, and the API refuses to delete
                 them regardless. Sits outside the link — no button in an anchor. -->
            @if (!list.isSystem) {
              <div class="absolute top-1/2 right-2 -translate-y-1/2 sm:top-3 sm:right-3 sm:translate-y-0">
                <lt-menu triggerClass="btn btn-quiet btn-sm btn-icon" [label]="'Opções da lista ' + list.name">
                  <lt-icon trigger name="more" [size]="18" />
                  <button type="button" class="menu-item menu-item-danger" (click)="remove(list)">
                    <lt-icon name="trash" [size]="17" /> Excluir lista
                  </button>
                </lt-menu>
              </div>
            }
          </li>
        }
      </ul>
    }

    <lt-sheet [open]="creating()" heading="Nova lista" eyebrow="Organize do seu jeito" (closed)="creating.set(false)">
      <form (ngSubmit)="create()">
        <label class="label" for="new-list">Nome da lista</label>
        <input
          id="new-list"
          class="field"
          [(ngModel)]="newName"
          name="newName"
          placeholder="Ex.: Jogos para levar no sítio"
          maxlength="60"
          autocomplete="off"
          autofocus
        />
        <p class="hint mt-2">Listas próprias podem ser excluídas depois. Os jogos continuam nas outras listas.</p>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost" (click)="creating.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="busy() || !newName().trim()">
            {{ busy() ? 'Criando…' : 'Criar lista' }}
          </button>
        </div>
      </form>
    </lt-sheet>
  `,
  styles: [
    `
      .arrow {
        transition:
          transform var(--dur-base) var(--ease-out),
          color var(--dur-fast) ease;
      }
      .group:hover .arrow {
        transform: translateX(4px);
        color: var(--ink);
      }
      .tile {
        transition: transform var(--dur-base) var(--ease-spring);
      }
      .group:hover .tile {
        transform: rotate(-4deg);
      }
    `,
  ],
})
export class ListsPage {
  private readonly service = inject(ListsService);
  private readonly feedback = inject(FeedbackService);

  protected readonly lists = signal<List[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly newName = signal('');

  protected readonly subtitle = computed(() => {
    const collection = this.lists().find((l) => l.kind === 'collection');
    if (!collection) return 'Sua coleção, seus desejos e o que você montar.';
    const n = collection.itemCount;
    return `${n} ${n === 1 ? 'jogo' : 'jogos'} na estante, em ${this.lists().length} listas.`;
  });

  constructor() {
    void this.load();
  }

  protected meta(list: List) {
    return KIND_META[list.kind];
  }

  protected monogram(list: List): string {
    return (list.name.trim()[0] ?? '?').toUpperCase();
  }

  protected startCreate(): void {
    this.newName.set('');
    this.creating.set(true);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.lists.set(await this.service.lists());
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar suas listas.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Deleting a list drops its items, so it asks first and says how many. The
   * games themselves survive — a list_item is a placement, not the game.
   */
  protected async remove(list: List): Promise<void> {
    const count = list.itemCount;
    const ok = await this.feedback.confirm({
      title: `Excluir "${list.name}"?`,
      message:
        (count > 0 ? `${count} ${count === 1 ? 'jogo sai' : 'jogos saem'} desta lista. ` : '') +
        'Os jogos continuam nas suas outras listas.',
      confirmLabel: 'Excluir lista',
      tone: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    try {
      await this.service.remove(list.publicId);
      this.lists.update((current) => current.filter((l) => l.publicId !== list.publicId));
      this.feedback.success(`Lista "${list.name}" excluída.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível excluir a lista.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;

    this.busy.set(true);
    try {
      const created = await this.service.create(name);
      this.lists.update((current) => [...current, created]);
      this.creating.set(false);
      this.newName.set('');
      this.feedback.success(`Lista "${created.name}" criada.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível criar a lista.');
    } finally {
      this.busy.set(false);
    }
  }
}
