import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { List } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
import { EmptyState, Skeleton } from '../../shared/ui';

const KIND_META: Record<List['kind'], { icon: string; blurb: string }> = {
  collection: { icon: '🎲', blurb: 'O que você tem na estante' },
  wishlist: { icon: '⭐', blurb: 'O que você quer comprar' },
  favorites: { icon: '❤️', blurb: 'Os que você sempre leva' },
  custom: { icon: '📋', blurb: 'Lista personalizada' },
};

@Component({
  selector: 'lt-lists',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Skeleton, EmptyState],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl">Minhas listas</h1>
        <p class="mt-1 text-sm text-muted">Sua coleção, seus desejos e o que você montar.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" (click)="startCreate()">Nova lista</button>
    </header>

    @if (creating()) {
      <form class="panel mb-5 flex flex-wrap gap-2 p-3" (ngSubmit)="create()">
        <label class="sr-only" for="new-list">Nome da lista</label>
        <input
          id="new-list"
          class="field flex-1"
          style="min-width: 12rem"
          [(ngModel)]="newName"
          name="newName"
          placeholder="Ex.: Jogos para levar no sítio"
          maxlength="60"
          autofocus
        />
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !newName().trim()">Criar</button>
        <button type="button" class="btn btn-quiet btn-sm" (click)="creating.set(false)">Cancelar</button>
      </form>
    }

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div class="card p-5">
            <lt-skeleton height="1.25rem" width="60%" />
            <div class="mt-3"><lt-skeleton height="0.75rem" width="80%" /></div>
          </div>
        }
      </div>
    } @else if (lists().length === 0) {
      <lt-empty title="Nenhuma lista ainda" message="Crie uma lista para começar a organizar seus jogos.">
        <button type="button" class="btn btn-primary" (click)="startCreate()">Nova lista</button>
      </lt-empty>
    } @else {
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (list of lists(); track list.publicId; let i = $index) {
          <li class="animate-rise" [style.animation-delay.ms]="i * 40">
            <a
              [routerLink]="['/listas', list.publicId]"
              class="card flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5"
            >
              <div class="mb-3 flex items-start justify-between gap-3">
                <span class="text-2xl" aria-hidden="true">{{ meta(list).icon }}</span>
                @if (list.isSystem) {
                  <span class="chip">Padrão</span>
                }
              </div>
              <h2 class="text-lg">{{ list.name }}</h2>
              <p class="mt-0.5 mb-4 text-xs text-muted">{{ meta(list).blurb }}</p>
              <p class="mt-auto text-sm text-muted">
                <span class="stat font-semibold text-strong">{{ list.itemCount }}</span>
                {{ list.itemCount === 1 ? 'jogo' : 'jogos' }}
              </p>
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class ListsPage {
  private readonly service = inject(ListsService);

  protected readonly lists = signal<List[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly newName = signal('');

  constructor() {
    void this.load();
  }

  protected meta(list: List) {
    return KIND_META[list.kind];
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

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      const created = await this.service.create(name);
      this.lists.update((current) => [...current, created]);
      this.creating.set(false);
      this.newName.set('');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível criar a lista.');
    } finally {
      this.busy.set(false);
    }
  }
}
