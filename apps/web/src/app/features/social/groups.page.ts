import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { FriendGroup, GroupInvite, GroupVisibility, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

@Component({
  selector: 'lt-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, SeatToken, Skeleton, EmptyState],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl">Grupos</h1>
        <p class="mt-1 text-sm text-muted">Junte a estante da turma e veja quem tem o quê.</p>
      </div>
      <div class="flex gap-2">
        <a routerLink="/grupos/explorar" class="btn btn-ghost btn-sm"><lt-icon name="globe" [size]="16" /> Explorar</a>
        <button type="button" class="btn btn-primary btn-sm" (click)="creating.set(!creating())">Novo grupo</button>
      </div>
    </header>

    @if (creating()) {
      <form class="panel mb-5 p-4" (ngSubmit)="create()">
        <label class="label" for="group-name">Nome do grupo</label>
        <input id="group-name" class="field mb-4" [(ngModel)]="name" name="name" placeholder="Ex.: Mesa de Sexta" maxlength="60" />

        <p class="label">Visibilidade</p>
        <div class="mb-4 grid gap-2 sm:grid-cols-2">
          @for (v of visibilityOptions; track v.value) {
            <label
              class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3"
              [style.border-color]="visibility() === v.value ? 'var(--color-brand-500)' : 'var(--border-subtle)'"
              [style.background]="visibility() === v.value ? 'color-mix(in srgb, var(--color-brand-500) 8%, transparent)' : 'transparent'"
            >
              <input type="radio" name="visibility" class="mt-1 accent-[var(--color-brand-600)]" [value]="v.value" [ngModel]="visibility()" (ngModelChange)="visibility.set($event)" />
              <span>
                <span class="flex items-center gap-1.5 text-sm font-semibold text-strong"><lt-icon [name]="v.icon" [size]="15" /> {{ v.label }}</span>
                <span class="block text-xs text-muted">{{ v.hint }}</span>
              </span>
            </label>
          }
        </div>

        @if (friends().length > 0) {
          <p class="label">Convidar amigos (opcional)</p>
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

    <!-- Pending invites first — they're waiting on the user to act. -->
    @if (invites().length > 0) {
      <section class="mb-6" aria-labelledby="invites-heading">
        <h2 id="invites-heading" class="mb-2 text-sm font-bold tracking-wide uppercase" style="color: var(--color-brand-500)">Convites</h2>
        <ul class="grid gap-2">
          @for (invite of invites(); track invite.group.publicId) {
            <li class="card animate-rise flex flex-wrap items-center gap-3 p-4">
              <lt-icon name="group" [size]="20" class="text-muted" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold text-strong">{{ invite.group.name }}</p>
                @if (invite.invitedBy) {
                  <p class="truncate text-xs text-muted">Convidado por {{ invite.invitedBy.displayName || invite.invitedBy.login }}</p>
                }
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="accept(invite)" [disabled]="busy()">Aceitar</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="declineInvite(invite)" [disabled]="busy()">Recusar</button>
            </li>
          }
        </ul>
      </section>
    }

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2">
        @for (i of [1, 2]; track i) {
          <div class="card p-5"><lt-skeleton height="1.25rem" width="50%" /></div>
        }
      </div>
    } @else if (groups().length === 0) {
      <lt-empty icon="group" title="Nenhum grupo ainda" message="Crie um grupo, ou explore os grupos abertos para pedir para entrar.">
        <div class="flex gap-2">
          <button type="button" class="btn btn-primary" (click)="creating.set(true)">Novo grupo</button>
          <a routerLink="/grupos/explorar" class="btn btn-ghost">Explorar grupos</a>
        </div>
      </lt-empty>
    } @else {
      <ul class="grid gap-4 sm:grid-cols-2">
        @for (group of groups(); track group.publicId; let i = $index) {
          <li class="animate-rise" [style.animation-delay.ms]="i * 40">
            <a [routerLink]="['/grupos', group.publicId]" class="card flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5">
              <div class="mb-3 flex items-start justify-between gap-2">
                <h2 class="text-lg">{{ group.name }}</h2>
                <div class="flex shrink-0 gap-1.5">
                  @if (group.isOwner) {
                    <span class="chip"><lt-icon name="crown" [size]="12" /> Dono</span>
                  } @else if (group.myRole === 'admin') {
                    <span class="chip">Admin</span>
                  }
                  <span class="chip" [title]="group.visibility === 'open' ? 'Aberto' : 'Fechado'">
                    <lt-icon [name]="group.visibility === 'open' ? 'globe' : 'lock'" [size]="12" />
                  </span>
                </div>
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
  private readonly auth = inject(AuthStore);

  protected readonly visibilityOptions: Array<{ value: GroupVisibility; label: string; hint: string; icon: 'lock' | 'globe' }> = [
    { value: 'closed', label: 'Fechado', hint: 'Só entra quem for convidado.', icon: 'lock' },
    { value: 'open', label: 'Aberto', hint: 'Aparece na busca; qualquer um pode pedir para entrar.', icon: 'globe' },
  ];

  protected readonly groups = signal<FriendGroup[]>([]);
  protected readonly invites = signal<GroupInvite[]>([]);
  protected readonly friends = signal<PublicUser[]>([]);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly name = signal('');
  protected readonly visibility = signal<GroupVisibility>('closed');
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
      const [groups, friends, invites] = await Promise.all([
        this.social.groups(),
        this.social.friends(),
        this.social.groupInvites(),
      ]);
      this.groups.set(groups);
      this.friends.set(friends.items);
      this.invites.set(invites);
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
      await this.social.createGroup({ name, visibility: this.visibility(), memberIds: [...this.picked()] });
      this.creating.set(false);
      this.name.set('');
      this.picked.set(new Set());
      this.visibility.set('closed');
      await this.load();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível criar o grupo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async accept(invite: GroupInvite): Promise<void> {
    await this.run(() => this.social.acceptInvite(invite.group.publicId));
  }

  protected async declineInvite(invite: GroupInvite): Promise<void> {
    // Declining = removing your own (invited) membership.
    const me = this.auth.user()?.publicId;
    if (!me) return;
    await this.run(() => this.social.removeMember(invite.group.publicId, me));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
      await this.load();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      this.busy.set(false);
    }
  }
}
