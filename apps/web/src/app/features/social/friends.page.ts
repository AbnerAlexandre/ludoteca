import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { FriendRequest, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Menu } from '../../shared/menu';
import { EmptyState, PageHead, SeatToken, Skeleton } from '../../shared/ui';

@Component({
  selector: 'lt-friends',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Skeleton, EmptyState, Icon, Menu, PageHead],
  template: `
    <lt-page-head eyebrow="Sua mesa" title="Amigos" subtitle="Quem pode ver seus jogos marcados como “amigos” — e de quem você vê os deles." />

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    <!-- Pending first: these are waiting on the user to act. -->
    @if (incoming().length > 0) {
      <section class="rise mb-8" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" class="section-label eyebrow text-brand-text!">
          Pedidos recebidos <span class="badge">{{ incoming().length }}</span>
        </h2>
        <ul class="grid gap-2.5 sm:grid-cols-2">
          @for (req of incoming(); track req.publicId; let i = $index) {
            <li class="card pop-in flex flex-wrap items-center gap-3 p-3.5" [style.--i]="i">
              <a [routerLink]="['/perfil', req.user.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
                <lt-seat [user]="req.user" size="lg" />
                <span class="min-w-0">
                  <span class="block truncate font-semibold text-ink">{{ req.user.displayName || req.user.login }}</span>
                  <span class="meta block truncate">{{ '@' + req.user.login }}</span>
                </span>
              </a>
              <div class="flex gap-2">
                <button type="button" class="btn btn-primary btn-sm" (click)="accept(req)" [disabled]="busy()">Aceitar</button>
                <button type="button" class="btn btn-quiet btn-sm" (click)="dismiss(req)" [disabled]="busy()">Recusar</button>
              </div>
            </li>
          }
        </ul>
      </section>
    }

    <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <section aria-labelledby="friends-heading" class="min-w-0">
        <h2 id="friends-heading" class="section-label eyebrow">
          Meus amigos <span class="stat">{{ friends().length }}</span>
        </h2>

        @if (loading()) {
          <div class="rows">
            @for (i of [1, 2, 3]; track i) {
              <div class="row"><lt-skeleton height="2rem" width="2rem" /><div class="flex-1"><lt-skeleton height="1rem" width="40%" /></div></div>
            }
          </div>
        } @else if (friends().length === 0) {
          <lt-empty title="Nenhum amigo ainda" message="Busque pelo login de alguém para enviar um pedido de amizade." />
        } @else {
          <ul class="rows">
            @for (friend of friends(); track friend.publicId; let i = $index) {
              <li class="row row-hover fade-in" [style.--i]="i">
                <a [routerLink]="['/perfil', friend.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
                  <lt-seat [user]="friend" />
                  <span class="min-w-0">
                    <span class="block truncate font-semibold text-ink">{{ friend.displayName || friend.login }}</span>
                    <span class="meta block truncate">{{ '@' + friend.login }}</span>
                  </span>
                </a>
                <lt-menu triggerClass="btn btn-quiet btn-sm btn-icon" [label]="'Opções para ' + friend.login">
                  <lt-icon trigger name="more" [size]="18" />
                  <a class="menu-item" [routerLink]="['/perfil', friend.publicId]"><lt-icon name="user" [size]="17" /> Ver perfil</a>
                  <button type="button" class="menu-item menu-item-danger" (click)="unfriend(friend)">
                    <lt-icon name="close" [size]="17" /> Desfazer amizade
                  </button>
                </lt-menu>
              </li>
            }
          </ul>
        }
      </section>

      <aside class="min-w-0 space-y-8">
        <section aria-labelledby="search-heading">
          <h2 id="search-heading" class="section-label eyebrow">Encontrar pessoas</h2>
          <form class="search-box" (ngSubmit)="search()" role="search">
            <lt-icon name="search" [size]="17" />
            <label class="sr-only" for="user-q">Login ou nome</label>
            <input id="user-q" class="field" [(ngModel)]="query" name="q" placeholder="Login ou nome…" minlength="2" maxlength="80" autocomplete="off" enterkeyhint="search" />
          </form>

          @if (results().length > 0) {
            <ul class="mt-3 grid gap-1">
              @for (user of results(); track user.publicId; let i = $index) {
                <li class="fade-in flex items-center gap-3 rounded-[var(--r)] p-2 hover:bg-surface-2" [style.--i]="i">
                  <a [routerLink]="['/perfil', user.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
                    <lt-seat [user]="user" />
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-ink">{{ user.displayName || user.login }}</span>
                      <span class="meta block truncate">{{ '@' + user.login }}</span>
                    </span>
                  </a>
                  @switch (user.relation) {
                    @case ('friend') {
                      <span class="tag tag-mint">Amigo</span>
                    }
                    @case ('request_sent') {
                      <span class="tag">Enviado</span>
                    }
                    @case ('request_received') {
                      <span class="tag tag-brand">Te chamou</span>
                    }
                    @case ('self') {
                      <span class="tag">Você</span>
                    }
                    @default {
                      <button type="button" class="btn btn-soft btn-sm" (click)="add(user)" [disabled]="busy()">Adicionar</button>
                    }
                  }
                </li>
              }
            </ul>
          } @else if (searched()) {
            <p class="mt-3 text-sm text-ink-3">Ninguém encontrado com esse login ou nome.</p>
          }
        </section>

        @if (outgoing().length > 0) {
          <section aria-labelledby="outgoing-heading">
            <h2 id="outgoing-heading" class="section-label eyebrow">Pedidos enviados</h2>
            <ul class="grid gap-1">
              @for (req of outgoing(); track req.publicId) {
                <li class="flex items-center gap-3 rounded-[var(--r)] p-2">
                  <lt-seat [user]="req.user" size="sm" />
                  <span class="min-w-0 flex-1 truncate text-sm text-ink-2">{{ req.user.displayName || req.user.login }}</span>
                  <button type="button" class="btn btn-quiet btn-sm" (click)="dismiss(req)" [disabled]="busy()">Cancelar</button>
                </li>
              }
            </ul>
          </section>
        }
      </aside>
    </div>
  `,
})
export class FriendsPage {
  private readonly social = inject(SocialService);
  private readonly feedback = inject(FeedbackService);

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
    try {
      const page = await this.social.searchUsers(q);
      this.results.set(page.items);
      this.searched.set(true);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível buscar.');
    }
  }

  protected async add(user: PublicUser): Promise<void> {
    await this.run(async () => {
      await this.social.sendRequest(user.publicId);
      // Reflect the new state in the result row without a second search.
      this.results.update((current) =>
        current.map((u) => (u.publicId === user.publicId ? { ...u, relation: 'request_sent' as const } : u)),
      );
      this.feedback.success(`Pedido enviado para ${user.displayName || user.login}.`);
      await this.load();
    }, 'Não foi possível enviar o pedido.');
  }

  protected async accept(req: FriendRequest): Promise<void> {
    await this.run(async () => {
      await this.social.acceptRequest(req.publicId);
      this.feedback.success(`Você e ${req.user.displayName || req.user.login} agora são amigos.`);
      await this.load();
    }, 'Não foi possível aceitar.');
  }

  protected async dismiss(req: FriendRequest): Promise<void> {
    await this.run(() => this.social.dismissRequest(req.publicId).then(() => this.load()), 'Não foi possível concluir.');
  }

  protected async unfriend(user: PublicUser): Promise<void> {
    const name = user.displayName || user.login;
    const ok = await this.feedback.confirm({
      title: `Desfazer amizade com ${name}?`,
      message: 'Vocês deixam de ver os jogos marcados como “amigos” um do outro. Dá para mandar um pedido de novo depois.',
      confirmLabel: 'Desfazer amizade',
      tone: 'danger',
    });
    if (!ok) return;
    await this.run(() => this.social.unfriend(user.publicId).then(() => this.load()), 'Não foi possível remover.');
  }

  private async run(action: () => Promise<unknown>, fallback: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : fallback);
    } finally {
      this.busy.set(false);
    }
  }
}
