import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { FriendGroup, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { SocialService } from '../../core/social.service';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

@Component({
  selector: 'lt-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Skeleton, EmptyState],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl">Grupos</h1>
        <p class="mt-1 text-sm text-muted">Junte a estante da turma e veja quem tem o quê.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" (click)="creating.set(!creating())">Novo grupo</button>
    </header>

    @if (creating()) {
      <form class="panel mb-5 p-4" (ngSubmit)="create()">
        <label class="label" for="group-name">Nome do grupo</label>
        <input id="group-name" class="field mb-4" [(ngModel)]="name" name="name" placeholder="Ex.: Mesa de Sexta" maxlength="60" />

        @if (friends().length > 0) {
          <p class="label">Quem entra</p>
          <ul class="mb-4 grid gap-1.5 sm:grid-cols-2">
            @for (friend of friends(); track friend.publicId) {
              <li>
                <label class="flex cursor-pointer items-center gap-2.5 rounded-xl p-2 hover:bg-sunken">
                  <input type="checkbox" class="h-4 w-4 accent-[var(--color-brand-600)]" [checked]="picked().has(friend.publicId)" (change)="togglePick(friend.publicId)" />
                  <lt-seat [user]="friend" />
                  <span class="min-w-0 flex-1 truncate text-sm">{{ friend.displayName || friend.login }}</span>
                </label>
              </li>
            }
          </ul>
        } @else {
          <p class="hint mb-4">Você ainda não tem amigos para adicionar. Só é possível adicionar amigos a um grupo.</p>
        }

        <div class="flex gap-2">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !name().trim()">Criar grupo</button>
          <button type="button" class="btn btn-quiet btn-sm" (click)="creating.set(false)">Cancelar</button>
        </div>
      </form>
    }

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2">
        @for (i of [1, 2]; track i) {
          <div class="card p-5"><lt-skeleton height="1.25rem" width="50%" /></div>
        }
      </div>
    } @else if (groups().length === 0) {
      <lt-empty icon="group" title="Nenhum grupo ainda" message="Crie um grupo com seus amigos para ver a coleção de todo mundo junta.">
        <button type="button" class="btn btn-primary" (click)="creating.set(true)">Novo grupo</button>
      </lt-empty>
    } @else {
      <ul class="grid gap-4 sm:grid-cols-2">
        @for (group of groups(); track group.publicId; let i = $index) {
          <li class="animate-rise" [style.animation-delay.ms]="i * 40">
            <a [routerLink]="['/grupos', group.publicId]" class="card flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5">
              <div class="mb-3 flex items-start justify-between gap-2">
                <h2 class="text-lg">{{ group.name }}</h2>
                @if (group.isOwner) {
                  <span class="chip">Você criou</span>
                }
              </div>
              <p class="mt-auto text-sm text-muted">
                <span class="stat font-semibold text-strong">{{ group.memberCount }}</span>
                {{ group.memberCount === 1 ? 'membro' : 'membros' }}
              </p>
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class GroupsPage {
  private readonly social = inject(SocialService);

  protected readonly groups = signal<FriendGroup[]>([]);
  protected readonly friends = signal<PublicUser[]>([]);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly name = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [groups, friends] = await Promise.all([this.social.groups(), this.social.friends()]);
      this.groups.set(groups);
      this.friends.set(friends.items);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar seus grupos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected togglePick(id: string): void {
    this.picked.update((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  protected async create(): Promise<void> {
    const name = this.name().trim();
    if (!name) return;

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.social.createGroup(name, [...this.picked()]);
      this.creating.set(false);
      this.name.set('');
      this.picked.set(new Set());
      await this.load();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível criar o grupo.');
    } finally {
      this.busy.set(false);
    }
  }
}
