import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GroupDirectoryEntry } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

/**
 * The public directory of open groups. Anyone can browse and ask to join; an
 * admin of the group then approves. Closed groups never appear here — they are
 * invite-only.
 */
@Component({
  selector: 'lt-group-directory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, SeatToken, Skeleton, EmptyState],
  template: `
    <a routerLink="/grupos" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong">
      <lt-icon name="arrow-left" [size]="16" /> Meus grupos
    </a>

    <header class="mb-5">
      <h1 class="text-3xl">Explorar grupos</h1>
      <p class="mt-1 text-sm text-muted">Grupos abertos que você pode pedir para entrar.</p>
    </header>

    <form class="panel mb-4 flex gap-2 p-2.5" (ngSubmit)="search()">
      <label class="sr-only" for="gq">Buscar grupo</label>
      <input id="gq" class="field flex-1" [(ngModel)]="query" name="q" placeholder="Buscar por nome…" maxlength="80" />
      <button type="submit" class="btn btn-primary">Buscar</button>
    </form>

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2">
        @for (i of [1, 2]; track i) {
          <div class="card p-5"><lt-skeleton height="1.25rem" width="50%" /></div>
        }
      </div>
    } @else if (groups().length === 0) {
      <lt-empty icon="globe" title="Nenhum grupo aberto" message="Quando alguém criar um grupo aberto, ele aparece aqui." />
    } @else {
      <ul class="grid gap-3 sm:grid-cols-2">
        @for (group of groups(); track group.publicId; let i = $index) {
          <li class="card animate-rise flex flex-col p-5" [style.animation-delay.ms]="i * 40">
            <div class="mb-2 flex items-start justify-between gap-2">
              <a [routerLink]="['/grupos', group.publicId]" class="text-lg font-semibold text-strong hover:underline">{{ group.name }}</a>
              <span class="chip"><lt-icon name="globe" [size]="12" /> Aberto</span>
            </div>
            <div class="mb-4 flex items-center gap-2 text-xs text-muted">
              <lt-seat [user]="group.owner" />
              <span>por {{ group.owner.displayName || group.owner.login }}</span>
              <span>·</span>
              <span class="stat">{{ group.memberCount }}</span>
              <span>{{ group.memberCount === 1 ? 'membro' : 'membros' }}</span>
            </div>
            <div class="mt-auto">
              @switch (group.relation) {
                @case ('member') {
                  <a [routerLink]="['/grupos', group.publicId]" class="btn btn-ghost btn-sm w-full">Abrir grupo</a>
                }
                @case ('requested') {
                  <span class="chip">Pedido enviado</span>
                }
                @case ('invited') {
                  <a routerLink="/grupos" class="btn btn-ghost btn-sm w-full">Convite pendente</a>
                }
                @default {
                  <button type="button" class="btn btn-primary btn-sm w-full" (click)="join(group)" [disabled]="busy() === group.publicId">
                    {{ busy() === group.publicId ? 'Enviando…' : 'Pedir para entrar' }}
                  </button>
                }
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class GroupDirectoryPage {
  private readonly social = inject(SocialService);

  protected readonly groups = signal<GroupDirectoryEntry[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async search(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.social.groupDirectory(this.query().trim() || undefined);
      this.groups.set(page.items);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar os grupos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async join(group: GroupDirectoryEntry): Promise<void> {
    this.busy.set(group.publicId);
    this.error.set(null);
    try {
      await this.social.requestToJoin(group.publicId);
      // Reflect the new state without a full reload.
      this.groups.update((gs) =>
        gs.map((g) => (g.publicId === group.publicId ? { ...g, relation: 'requested' as const } : g)),
      );
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      this.busy.set(null);
    }
  }
}
