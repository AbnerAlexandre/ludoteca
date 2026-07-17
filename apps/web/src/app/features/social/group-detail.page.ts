import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { FriendGroupDetail, GroupGame } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { assignSeats } from '../../core/seat';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

/**
 * The aggregated shelf — the screen the seat colours exist for.
 *
 * Each row is a game the group owns, followed by the seat tokens of whoever
 * owns it. That's the spec's "indicator of which members own each game",
 * answered by colour rather than by a list of names you'd have to read.
 *
 * The owner list is what the *viewer* is allowed to see: a member's
 * friends-only game only counts toward the row if you're actually their friend.
 * So two members can legitimately see different owners for the same game.
 */
@Component({
  selector: 'lt-group-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Skeleton, EmptyState, Icon],
  template: `
    <a routerLink="/grupos" class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-strong">
      <lt-icon name="arrow-left" [size]="16" /> Grupos
    </a>

    <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-3xl">{{ group()?.name ?? 'Grupo' }}</h1>
        @if (group(); as g) {
          <div class="seat-stack mt-3 flex items-center">
            @for (member of g.members; track member.publicId) {
              <lt-seat [user]="member" [seat]="seats().get(member.publicId)" />
            }
            <span class="ml-3 text-sm text-muted">
              <span class="stat">{{ g.memberCount }}</span> {{ g.memberCount === 1 ? 'membro' : 'membros' }}
            </span>
          </div>
        }
      </div>
      @if (group()?.isOwner) {
        <button type="button" class="btn btn-ghost btn-sm" (click)="remove()" [disabled]="busy()">Excluir grupo</button>
      }
    </header>

    <div class="panel mb-4 flex flex-wrap items-center gap-2 p-2.5">
      <label class="sr-only" for="gq">Filtrar jogos</label>
      <input id="gq" class="field flex-1" style="min-width: 10rem" [(ngModel)]="query" placeholder="Filtrar jogos…" (keyup.enter)="reload()" />

      <label class="sr-only" for="gsort">Ordenar por</label>
      <select id="gsort" class="field w-auto" [ngModel]="sort()" (ngModelChange)="setSort($event)">
        <option value="name">Nome</option>
        <option value="owners">Quantos têm</option>
        <option value="type">Tipo</option>
      </select>

      <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="toggleDir()" [attr.aria-label]="dir() === 'asc' ? 'Crescente. Inverter.' : 'Decrescente. Inverter.'">
        <lt-icon [name]="dir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="17" />
      </button>
    </div>

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <ul class="grid gap-3">
        @for (i of [1, 2, 3]; track i) {
          <li class="card flex items-center gap-4 p-3">
            <lt-skeleton height="3.5rem" width="3.5rem" />
            <div class="flex-1"><lt-skeleton height="1rem" width="40%" /></div>
          </li>
        }
      </ul>
    } @else if (games().length === 0) {
      <lt-empty icon="dice" title="Nenhum jogo à vista" message="Quando os membros marcarem jogos como visíveis para você, eles aparecem aqui." />
    } @else {
      <p class="mb-3 text-sm text-muted">
        <span class="stat font-semibold text-strong">{{ total() }}</span> {{ total() === 1 ? 'jogo' : 'jogos' }} na estante do grupo
      </p>
      <ul class="grid gap-3">
        @for (row of games(); track row.game.publicId; let i = $index) {
          <li class="card animate-rise flex flex-wrap items-center gap-3 p-3" [style.animation-delay.ms]="i * 25">
            @if (row.game.thumbnail) {
              <img [src]="row.game.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" style="background: var(--surface-sunken)" />
            } @else {
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="20" /></span>
            }
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-strong">{{ row.game.name }}</p>
              <p class="mt-0.5 flex items-center gap-2 text-xs text-muted">
                @if (row.game.year) {
                  <span class="stat">{{ row.game.year }}</span>
                }
                <span class="chip">{{ typeLabel(row.game.type) }}</span>
              </p>
            </div>

            <!-- The signature: who owns it, as colour. -->
            <div class="seat-stack flex items-center" [attr.aria-label]="ownersLabel(row)">
              @for (owner of row.owners; track owner.publicId) {
                <lt-seat [user]="owner" [seat]="seats().get(owner.publicId)" />
              }
            </div>
            <span class="stat w-8 shrink-0 text-right text-sm font-semibold text-muted">×{{ row.ownerCount }}</span>
          </li>
        }
      </ul>
    }
  `,
})
export class GroupDetailPage {
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);

  readonly groupId = input.required<string>();

  protected readonly group = signal<FriendGroupDetail | null>(null);
  protected readonly games = signal<GroupGame[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly sort = signal<'name' | 'owners' | 'type'>('name');
  protected readonly dir = signal<'asc' | 'desc'>('asc');

  /**
   * Seats are assigned across the group's members, not per person, so no two
   * people in this view share a colour. The token row is the whole point of the
   * screen — a collision here would make it lie.
   */
  protected readonly seats = computed(() => assignSeats((this.group()?.members ?? []).map((m) => m.publicId)));

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected typeLabel(type: string): string {
    return { board: 'Tabuleiro', cards: 'Cartas', expansion: 'Expansão', rpg: 'RPG', other: 'Outro' }[type] ?? type;
  }

  /** The colours are the fast path; this is the accessible one. */
  protected ownersLabel(row: GroupGame): string {
    const names = row.owners.map((o) => o.displayName || o.login).join(', ');
    return `Quem tem: ${names}`;
  }

  protected setSort(sort: 'name' | 'owners' | 'type'): void {
    this.sort.set(sort);
    void this.load();
  }

  protected toggleDir(): void {
    this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [group, page] = await Promise.all([
        this.social.group(this.groupId()),
        this.social.groupGames(this.groupId(), {
          sort: this.sort(),
          dir: this.dir(),
          pageSize: 100,
          ...(this.query().trim() ? { q: this.query().trim() } : {}),
        }),
      ]);
      this.group.set(group);
      this.games.set(page.items);
      this.total.set(page.total);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o grupo.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (!confirm('Excluir este grupo? Os jogos e amizades continuam intactos.')) return;
    this.busy.set(true);
    try {
      await this.social.deleteGroup(this.groupId());
      await this.router.navigateByUrl('/grupos');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível excluir o grupo.');
    } finally {
      this.busy.set(false);
    }
  }
}
