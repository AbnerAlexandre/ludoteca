import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GroupDirectoryEntry } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, PageHead, SeatToken, Skeleton } from '../../shared/ui';

/**
 * The public directory of open groups. Anyone can browse and ask to join; an
 * admin of the group then approves. Closed groups never appear here — they are
 * invite-only.
 */
@Component({
  selector: 'lt-group-directory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, SeatToken, Skeleton, EmptyState, PageHead],
  template: `
    <a routerLink="/grupos" class="back-link"><lt-icon name="arrow-left" [size]="16" /> Meus grupos</a>

    <lt-page-head eyebrow="Grupos abertos" title="Explorar grupos" subtitle="Encontre uma mesa e peça para entrar. Um admin do grupo aprova." />

    <form class="search-box rise mb-7" style="--i: 2" (ngSubmit)="search()" role="search">
      <lt-icon name="search" [size]="18" />
      <label class="sr-only" for="gq">Buscar grupo</label>
      <input id="gq" class="field" [(ngModel)]="query" name="q" placeholder="Buscar por nome…" maxlength="80" autocomplete="off" enterkeyhint="search" />
    </form>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    @if (loading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div class="card p-5"><lt-skeleton height="1.4rem" width="55%" /><div class="mt-4"><lt-skeleton height="0.8rem" width="70%" /></div></div>
        }
      </div>
    } @else if (groups().length === 0) {
      <lt-empty title="Nenhum grupo aberto" [message]="query().trim() ? 'Nenhum grupo aberto com esse nome.' : 'Quando alguém criar um grupo aberto, ele aparece aqui.'" />
    } @else {
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (group of groups(); track group.publicId; let i = $index) {
          <li class="card rise flex flex-col p-5" [style.--i]="i">
            <a [routerLink]="['/grupos', group.publicId]" class="font-display text-[1.35rem] font-bold leading-tight tracking-tight text-ink hover:underline">{{ group.name }}</a>
            <p class="mt-3 flex items-center gap-2 text-sm text-ink-3">
              <lt-seat [user]="group.owner" size="sm" />
              <span class="min-w-0 truncate">por {{ group.owner.displayName || group.owner.login }}</span>
            </p>
            <div class="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
              <span class="text-sm text-ink-3"><span class="num text-xl text-ink">{{ group.memberCount }}</span> {{ group.memberCount === 1 ? 'membro' : 'membros' }}</span>
              @switch (group.relation) {
                @case ('member') {
                  <a [routerLink]="['/grupos', group.publicId]" class="btn btn-ghost btn-sm">Abrir</a>
                }
                @case ('requested') {
                  <span class="tag tag-brand">Pedido enviado</span>
                }
                @case ('invited') {
                  <a routerLink="/grupos" class="btn btn-soft btn-sm">Ver convite</a>
                }
                @default {
                  <button type="button" class="btn btn-primary btn-sm" (click)="join(group)" [disabled]="busy() === group.publicId">
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
  private readonly feedback = inject(FeedbackService);

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
    try {
      await this.social.requestToJoin(group.publicId);
      // Reflect the new state without a full reload.
      this.groups.update((gs) => gs.map((g) => (g.publicId === group.publicId ? { ...g, relation: 'requested' as const } : g)));
      this.feedback.success(`Pedido enviado para ${group.name}.`);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível enviar o pedido.');
    } finally {
      this.busy.set(null);
    }
  }
}
