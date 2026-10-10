import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { FriendGroup, GroupInvite, GroupVisibility, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { FeedbackService } from '../../core/feedback.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Sheet } from '../../shared/sheet';
import { EmptyState, PageHead, SeatToken, Skeleton } from '../../shared/ui';

@Component({
  selector: 'lt-groups',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, SeatToken, Skeleton, EmptyState, Sheet, PageHead],
  template: `
    <lt-page-head eyebrow="A estante da turma" title="Grupos" subtitle="Junte as coleções do grupo e veja, de relance, quem tem cada jogo.">
      <a routerLink="/grupos/explorar" class="btn btn-ghost"><lt-icon name="globe" [size]="17" /> Explorar</a>
      <button type="button" class="btn btn-primary" (click)="startCreate()"><lt-icon name="plus" [size]="18" /> Novo grupo</button>
    </lt-page-head>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    <!-- Pending invites first — they're waiting on the user to act. -->
    @if (invites().length > 0) {
      <section class="rise mb-8" aria-labelledby="invites-heading">
        <h2 id="invites-heading" class="section-label eyebrow text-brand-text!">
          Convites <span class="badge">{{ invites().length }}</span>
        </h2>
        <ul class="grid gap-2.5 sm:grid-cols-2">
          @for (invite of invites(); track invite.group.publicId; let i = $index) {
            <li class="card pop-in flex flex-wrap items-center gap-3 p-4" [style.--i]="i">
              <div class="min-w-0 flex-1">
                <p class="truncate font-display text-lg font-bold text-ink">{{ invite.group.name }}</p>
                @if (invite.invitedBy) {
                  <p class="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    <lt-seat [user]="invite.invitedBy" size="sm" /> convite de {{ invite.invitedBy.displayName || invite.invitedBy.login }}
                  </p>
                }
              </div>
              <div class="flex gap-2">
                <button type="button" class="btn btn-primary btn-sm" (click)="accept(invite)" [disabled]="busy()">Entrar</button>
                <button type="button" class="btn btn-quiet btn-sm" (click)="declineInvite(invite)" [disabled]="busy()">Recusar</button>
              </div>
            </li>
          }
        </ul>
      </section>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div class="card p-5"><lt-skeleton height="0.8rem" width="30%" /><div class="mt-4"><lt-skeleton height="1.4rem" width="60%" /></div></div>
        }
      </div>
    } @else if (groups().length === 0) {
      <lt-empty title="Nenhum grupo ainda" message="Crie um grupo para a sua mesa de sexta, ou explore os grupos abertos e peça para entrar.">
        <button type="button" class="btn btn-primary" (click)="startCreate()">Novo grupo</button>
        <a routerLink="/grupos/explorar" class="btn btn-ghost">Explorar grupos</a>
      </lt-empty>
    } @else {
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (group of groups(); track group.publicId; let i = $index) {
          <li class="rise" [style.--i]="i">
            <a [routerLink]="['/grupos', group.publicId]" class="card card-link group flex h-full flex-col p-5">
              <span class="flex flex-wrap gap-1.5">
                <span class="tag">
                  <lt-icon [name]="group.visibility === 'open' ? 'globe' : 'lock'" [size]="11" />
                  {{ group.visibility === 'open' ? 'Aberto' : 'Fechado' }}
                </span>
                @if (group.isOwner) {
                  <span class="tag tag-ink"><lt-icon name="crown" [size]="11" /> Dono</span>
                } @else if (group.myRole === 'admin') {
                  <span class="tag tag-brand">Admin</span>
                }
              </span>
              <span class="mt-4 mb-5 block font-display text-[1.4rem] font-bold leading-tight tracking-tight text-ink">{{ group.name }}</span>
              <span class="mt-auto flex items-end justify-between border-t border-line pt-4">
                <span>
                  <span class="num text-[1.75rem] text-ink">{{ group.memberCount }}</span>
                  <span class="ml-1.5 text-sm text-ink-3">{{ group.memberCount === 1 ? 'membro' : 'membros' }}</span>
                </span>
                <span class="arrow text-ink-3"><lt-icon name="arrow-right" [size]="20" /></span>
              </span>
            </a>
          </li>
        }
      </ul>
    }

    <lt-sheet [open]="creating()" heading="Novo grupo" eyebrow="Junte a turma" (closed)="creating.set(false)">
      <form (ngSubmit)="create()" class="grid gap-5">
        <div>
          <label class="label" for="group-name">Nome do grupo</label>
          <input id="group-name" class="field" [(ngModel)]="name" name="name" placeholder="Ex.: Mesa de sexta" maxlength="60" autocomplete="off" autofocus />
        </div>

        <fieldset>
          <legend class="label">Quem pode entrar</legend>
          <div class="grid gap-2 sm:grid-cols-2">
            @for (v of visibilityOptions; track v.value) {
              <label class="choice">
                <input type="radio" name="visibility" [value]="v.value" [ngModel]="visibility()" (ngModelChange)="visibility.set($event)" />
                <span>
                  <span class="flex items-center gap-1.5 text-sm font-semibold text-ink"><lt-icon [name]="v.icon" [size]="15" /> {{ v.label }}</span>
                  <span class="mt-0.5 block text-xs text-ink-3">{{ v.hint }}</span>
                </span>
              </label>
            }
          </div>
        </fieldset>

        @if (friends().length > 0) {
          <fieldset>
            <legend class="label">Convidar amigos <span class="font-normal text-ink-3">(opcional)</span></legend>
            <ul class="grid max-h-56 gap-0.5 overflow-y-auto rounded-[var(--r)] border border-line p-1">
              @for (friend of friends(); track friend.publicId) {
                <li>
                  <label class="flex cursor-pointer items-center gap-3 rounded-[var(--r-sm)] px-2 py-1.5 hover:bg-surface-2">
                    <input type="checkbox" class="h-4 w-4" [checked]="picked().has(friend.publicId)" (change)="togglePick(friend.publicId)" />
                    <lt-seat [user]="friend" size="sm" />
                    <span class="min-w-0 flex-1 truncate text-sm">{{ friend.displayName || friend.login }}</span>
                  </label>
                </li>
              }
            </ul>
          </fieldset>
        }

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost" (click)="creating.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="busy() || !name().trim()">
            {{ busy() ? 'Criando…' : picked().size > 0 ? 'Criar e convidar ' + picked().size : 'Criar grupo' }}
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
    `,
  ],
})
export class GroupsPage {
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackService);

  protected readonly visibilityOptions: Array<{ value: GroupVisibility; label: string; hint: string; icon: 'lock' | 'globe' }> = [
    { value: 'closed', label: 'Fechado', hint: 'Só entra quem for convidado.', icon: 'lock' },
    { value: 'open', label: 'Aberto', hint: 'Aparece em Explorar; qualquer um pode pedir para entrar.', icon: 'globe' },
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

  protected startCreate(): void {
    this.name.set('');
    this.picked.set(new Set());
    this.visibility.set('closed');
    this.creating.set(true);
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
    try {
      await this.social.createGroup({ name, visibility: this.visibility(), memberIds: [...this.picked()] });
      this.creating.set(false);
      this.feedback.success(`Grupo "${name}" criado.`);
      await this.load();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível criar o grupo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async accept(invite: GroupInvite): Promise<void> {
    await this.run(() => this.social.acceptInvite(invite.group.publicId), `Você entrou em ${invite.group.name}.`);
  }

  protected async declineInvite(invite: GroupInvite): Promise<void> {
    // Declining = removing your own (invited) membership.
    const me = this.auth.user()?.publicId;
    if (!me) return;
    await this.run(() => this.social.removeMember(invite.group.publicId, me));
  }

  private async run(action: () => Promise<unknown>, success?: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      if (success) this.feedback.success(success);
      await this.load();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      this.busy.set(false);
    }
  }
}
