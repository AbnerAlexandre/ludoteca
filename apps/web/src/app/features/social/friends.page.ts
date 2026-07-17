import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FriendRequest, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { SocialService } from '../../core/social.service';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

@Component({
  selector: 'lt-friends',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SeatToken, Skeleton, EmptyState],
  template: `
    <header class="mb-5">
      <h1 class="text-3xl">Amigos</h1>
      <p class="mt-1 text-sm text-muted">Quem está na sua mesa.</p>
    </header>

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    <!-- Pending first: these are the ones waiting on the user to act. -->
    @if (incoming().length > 0) {
      <section class="mb-6" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" class="mb-2 text-sm font-bold tracking-wide uppercase" style="color: var(--color-brand-500)">
          Pedidos recebidos
        </h2>
        <ul class="grid gap-2">
          @for (req of incoming(); track req.publicId) {
            <li class="card animate-rise flex items-center gap-3 p-3">
              <lt-seat [user]="req.user" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-strong">{{ req.user.displayName || req.user.login }}</p>
                <p class="truncate text-xs text-muted">{{ '@' + req.user.login }}</p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="accept(req)" [disabled]="busy()">Aceitar</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="dismiss(req)" [disabled]="busy()">Recusar</button>
            </li>
          }
        </ul>
      </section>
    }

    @if (outgoing().length > 0) {
      <section class="mb-6" aria-labelledby="outgoing-heading">
        <h2 id="outgoing-heading" class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Pedidos enviados</h2>
        <ul class="grid gap-2">
          @for (req of outgoing(); track req.publicId) {
            <li class="panel flex items-center gap-3 p-3">
              <lt-seat [user]="req.user" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-strong">{{ req.user.displayName || req.user.login }}</p>
                <p class="text-xs text-muted">Aguardando resposta</p>
              </div>
              <button type="button" class="btn btn-quiet btn-sm" (click)="dismiss(req)" [disabled]="busy()">Cancelar</button>
            </li>
          }
        </ul>
      </section>
    }

    <section class="mb-6" aria-labelledby="search-heading">
      <h2 id="search-heading" class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Encontrar pessoas</h2>
      <form class="panel mb-3 flex gap-2 p-2.5" (ngSubmit)="search()">
        <label class="sr-only" for="user-q">Login ou nome</label>
        <input id="user-q" class="field flex-1" [(ngModel)]="query" name="q" placeholder="Buscar por login ou nome…" minlength="2" maxlength="80" />
        <button type="submit" class="btn btn-primary" [disabled]="query().trim().length < 2">Buscar</button>
      </form>

      @if (results().length > 0) {
        <ul class="grid gap-2">
          @for (user of results(); track user.publicId) {
            <li class="card animate-rise flex items-center gap-3 p-3">
              <lt-seat [user]="user" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-strong">{{ user.displayName || user.login }}</p>
                <p class="truncate text-xs text-muted">{{ '@' + user.login }}</p>
              </div>
              @switch (user.relation) {
                @case ('friend') {
                  <span class="chip">Já são amigos</span>
                }
                @case ('request_sent') {
                  <span class="chip">Pedido enviado</span>
                }
                @case ('request_received') {
                  <span class="chip">Te enviou um pedido</span>
                }
                @default {
                  <button type="button" class="btn btn-primary btn-sm" (click)="add(user)" [disabled]="busy()">Adicionar</button>
                }
              }
            </li>
          }
        </ul>
      } @else if (searched()) {
        <p class="text-sm text-muted">Ninguém encontrado com esse login ou nome.</p>
      }
    </section>

    <section aria-labelledby="friends-heading">
      <h2 id="friends-heading" class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">
        Meus amigos <span class="stat">{{ friends().length }}</span>
      </h2>

      @if (loading()) {
        <div class="grid gap-2">
          @for (i of [1, 2]; track i) {
            <div class="card p-3"><lt-skeleton height="1.5rem" width="40%" /></div>
          }
        </div>
      } @else if (friends().length === 0) {
        <lt-empty icon="🤝" title="Nenhum amigo ainda" message="Busque pelo login de alguém para enviar um pedido." />
      } @else {
        <ul class="grid gap-2 sm:grid-cols-2">
          @for (friend of friends(); track friend.publicId) {
            <li class="card flex items-center gap-3 p-3">
              <lt-seat [user]="friend" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-strong">{{ friend.displayName || friend.login }}</p>
                <p class="truncate text-xs text-muted">{{ '@' + friend.login }}</p>
              </div>
              <button
                type="button"
                class="btn btn-quiet btn-sm"
                (click)="unfriend(friend)"
                [disabled]="busy()"
                [attr.aria-label]="'Desfazer amizade com ' + friend.login"
              >
                Remover
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class FriendsPage {
  private readonly social = inject(SocialService);

  protected readonly friends = signal<PublicUser[]>([]);
  protected readonly incoming = signal<FriendRequest[]>([]);
  protected readonly outgoing = signal<FriendRequest[]>([]);
  protected readonly results = signal<PublicUser[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [friends, requests] = await Promise.all([this.social.friends(), this.social.requests()]);
      this.friends.set(friends.items);
      this.incoming.set(requests.filter((r) => r.direction === 'incoming'));
      this.outgoing.set(requests.filter((r) => r.direction === 'outgoing'));
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar seus amigos.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async search(): Promise<void> {
    const q = this.query().trim();
    if (q.length < 2) return;
    this.error.set(null);
    try {
      const page = await this.social.searchUsers(q);
      this.results.set(page.items);
      this.searched.set(true);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível buscar.');
    }
  }

  protected async add(user: PublicUser): Promise<void> {
    await this.run(async () => {
      await this.social.sendRequest(user.publicId);
      // Reflect the new state in the result row without a second search.
      this.results.update((current) =>
        current.map((u) => (u.publicId === user.publicId ? { ...u, relation: 'request_sent' as const } : u)),
      );
      await this.load();
    }, 'Não foi possível enviar o pedido.');
  }

  protected async accept(req: FriendRequest): Promise<void> {
    await this.run(() => this.social.acceptRequest(req.publicId).then(() => this.load()), 'Não foi possível aceitar.');
  }

  protected async dismiss(req: FriendRequest): Promise<void> {
    await this.run(() => this.social.dismissRequest(req.publicId).then(() => this.load()), 'Não foi possível recusar.');
  }

  protected async unfriend(user: PublicUser): Promise<void> {
    await this.run(() => this.social.unfriend(user.publicId).then(() => this.load()), 'Não foi possível remover.');
  }

  private async run(action: () => Promise<unknown>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : fallback);
    } finally {
      this.busy.set(false);
    }
  }
}
