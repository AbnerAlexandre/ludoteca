import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GAME_TYPE_LABELS, type FriendGroupDetail, type GameTypeFilter, type GroupGame, type GroupMember, type PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { assignSeats } from '../../core/seat';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

type Tab = 'shelf' | 'members';

/**
 * A group's page: the aggregated shelf (the seat-colour signature) plus member
 * management. Admins invite/remove and handle join requests; the owner also
 * promotes/demotes and can delete the group. Everyone here is at least an
 * active member — invited users accept from "Meus grupos" first.
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

    @if (group(); as g) {
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-3xl">{{ g.name }}</h1>
            <span class="chip" [title]="g.visibility === 'open' ? 'Aberto' : 'Fechado'">
              <lt-icon [name]="g.visibility === 'open' ? 'globe' : 'lock'" [size]="12" />
              {{ g.visibility === 'open' ? 'Aberto' : 'Fechado' }}
            </span>
          </div>
          <div class="seat-stack mt-3 flex items-center">
            @for (member of g.members; track member.user.publicId) {
              <lt-seat [user]="member.user" [seat]="seats().get(member.user.publicId)" />
            }
            <span class="ml-3 text-sm text-muted">
              <span class="stat">{{ g.memberCount }}</span> {{ g.memberCount === 1 ? 'membro' : 'membros' }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (g.isOwner) {
            <button type="button" class="btn btn-ghost btn-sm btn-danger" (click)="removeGroup()" [disabled]="busy()">Excluir grupo</button>
          } @else {
            <button type="button" class="btn btn-ghost btn-sm" (click)="leave()" [disabled]="busy()">Sair do grupo</button>
          }
        </div>
      </header>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 rounded-xl p-1" style="background: var(--surface-sunken); width: fit-content">
        <button type="button" class="btn btn-sm" [class.btn-primary]="tab() === 'shelf'" [class.btn-quiet]="tab() !== 'shelf'" (click)="tab.set('shelf')">
          <lt-icon name="dice" [size]="16" /> Estante
        </button>
        <button type="button" class="btn btn-sm" [class.btn-primary]="tab() === 'members'" [class.btn-quiet]="tab() !== 'members'" (click)="tab.set('members')">
          <lt-icon name="users" [size]="16" /> Membros
          @if (g.canManage && g.requests.length > 0) {
            <span class="ml-1 rounded-full px-1.5 text-[0.65rem] font-bold" style="background: var(--color-brand-600); color: white">{{ g.requests.length }}</span>
          }
        </button>
      </div>

      @if (error(); as e) {
        <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
      }

      <!-- ============================== SHELF ============================== -->
      @if (tab() === 'shelf') {
        <div class="panel mb-4 flex flex-wrap items-center gap-2 p-2.5">
          <label class="sr-only" for="gq">Filtrar jogos</label>
          <input id="gq" class="field flex-1" style="min-width: 9rem" [(ngModel)]="query" placeholder="Filtrar jogos…" (keyup.enter)="reloadGames()" />

          <label class="sr-only" for="gowner">Filtrar por membro</label>
          <select id="gowner" class="field w-auto" [ngModel]="ownerFilter()" (ngModelChange)="setOwner($event)">
            <option value="">Todos os membros</option>
            @for (m of g.members; track m.user.publicId) {
              <option [value]="m.user.publicId">{{ m.user.displayName || m.user.login }}</option>
            }
          </select>

          <label class="sr-only" for="gsort">Ordenar por</label>
          <select id="gsort" class="field w-auto" [ngModel]="sort()" (ngModelChange)="setSort($event)">
            <option value="name">Nome</option>
            <option value="owners">Quantos têm</option>
            <option value="type">Tipo</option>
          </select>
          <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="toggleDir()" [attr.aria-label]="dir() === 'asc' ? 'Crescente' : 'Decrescente'">
            <lt-icon [name]="dir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="17" />
          </button>
        </div>

        <!-- Type filter chips -->
        <div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          @for (t of typeFilters; track t.value) {
            <button type="button" class="chip" [class.chip-active]="type() === t.value" (click)="setType(t.value)" [attr.aria-pressed]="type() === t.value">
              {{ t.label }}
            </button>
          }
        </div>

        @if (loading()) {
          <ul class="grid gap-3">
            @for (i of [1, 2, 3]; track i) {
              <li class="card flex items-center gap-4 p-3"><lt-skeleton height="3.5rem" width="3.5rem" /><div class="flex-1"><lt-skeleton height="1rem" width="40%" /></div></li>
            }
          </ul>
        } @else if (games().length === 0) {
          <lt-empty icon="dice" title="Nenhum jogo à vista" message="Ajuste os filtros, ou espere os membros marcarem jogos como visíveis para você." />
        } @else {
          <p class="mb-3 text-sm text-muted">
            <span class="stat font-semibold text-strong">{{ total() }}</span> {{ total() === 1 ? 'jogo' : 'jogos' }} na estante
          </p>
          <ul class="grid gap-3">
            @for (row of games(); track row.game.publicId; let i = $index) {
              <li class="card animate-rise flex flex-wrap items-center gap-3 p-3" [style.animation-delay.ms]="i * 25">
                <a [routerLink]="['/jogos', row.game.publicId]" class="flex min-w-0 flex-1 items-center gap-3">
                  @if (row.game.thumbnail) {
                    <img [src]="row.game.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" style="background: var(--surface-sunken)" />
                  } @else {
                    <span class="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-muted" style="background: var(--surface-sunken)"><lt-icon name="dice" [size]="20" /></span>
                  }
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold text-strong">{{ row.game.name }}</span>
                    <span class="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      @if (row.game.year) {
                        <span class="stat">{{ row.game.year }}</span>
                      }
                      <span class="chip">{{ typeLabel(row.game.type) }}</span>
                    </span>
                  </span>
                </a>
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
      }

      <!-- ============================= MEMBERS ============================= -->
      @if (tab() === 'members') {
        @if (g.canManage) {
          <section class="panel mb-5 p-4" aria-labelledby="invite-heading">
            <h2 id="invite-heading" class="mb-3 text-sm font-bold tracking-wide uppercase text-muted">Convidar pessoas</h2>
            <form class="flex gap-2" (ngSubmit)="searchUsers()">
              <input class="field flex-1" [(ngModel)]="userQuery" name="uq" placeholder="Buscar por login ou nome…" minlength="2" maxlength="80" />
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="userQuery().trim().length < 2">Buscar</button>
            </form>
            @if (userResults().length > 0) {
              <ul class="mt-3 grid gap-1.5">
                @for (u of userResults(); track u.publicId) {
                  <li class="flex items-center gap-2.5 rounded-xl p-2 hover:bg-sunken">
                    <lt-seat [user]="u" />
                    <span class="min-w-0 flex-1 truncate text-sm">{{ u.displayName || u.login }}</span>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="invite(u)" [disabled]="busy()">Convidar</button>
                  </li>
                }
              </ul>
            }
          </section>

          @if (g.requests.length > 0) {
            <section class="mb-5" aria-labelledby="req-heading">
              <h2 id="req-heading" class="mb-2 text-sm font-bold tracking-wide uppercase" style="color: var(--color-brand-500)">Pedidos para entrar</h2>
              <ul class="grid gap-2">
                @for (m of g.requests; track m.user.publicId) {
                  <li class="card flex items-center gap-3 p-3">
                    <lt-seat [user]="m.user" />
                    <a [routerLink]="['/perfil', m.user.publicId]" class="min-w-0 flex-1 truncate font-semibold text-strong hover:underline">{{ m.user.displayName || m.user.login }}</a>
                    <button type="button" class="btn btn-primary btn-sm" (click)="approve(m)" [disabled]="busy()">Aprovar</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="removeMember(m)" [disabled]="busy()">Recusar</button>
                  </li>
                }
              </ul>
            </section>
          }

          @if (g.invited.length > 0) {
            <section class="mb-5" aria-labelledby="inv-heading">
              <h2 id="inv-heading" class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Convites pendentes</h2>
              <ul class="grid gap-2">
                @for (m of g.invited; track m.user.publicId) {
                  <li class="panel flex items-center gap-3 p-3">
                    <lt-seat [user]="m.user" />
                    <span class="min-w-0 flex-1 truncate text-sm">{{ m.user.displayName || m.user.login }}</span>
                    <span class="text-xs text-muted">Aguardando</span>
                    <button type="button" class="btn btn-quiet btn-sm" (click)="removeMember(m)" [disabled]="busy()">Cancelar</button>
                  </li>
                }
              </ul>
            </section>
          }
        }

        <section aria-labelledby="mem-heading">
          <h2 id="mem-heading" class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Membros ativos</h2>
          <ul class="grid gap-2">
            @for (m of g.members; track m.user.publicId) {
              <li class="card flex flex-wrap items-center gap-3 p-3">
                <lt-seat [user]="m.user" [seat]="seats().get(m.user.publicId)" />
                <a [routerLink]="['/perfil', m.user.publicId]" class="min-w-0 flex-1 truncate font-semibold text-strong hover:underline">
                  {{ m.user.displayName || m.user.login }}
                </a>
                @if (m.isOwner) {
                  <span class="chip"><lt-icon name="crown" [size]="12" /> Dono</span>
                } @else if (m.role === 'admin') {
                  <span class="chip">Admin</span>
                }

                <!-- Owner can change roles and remove; admins can remove members. -->
                @if (g.isOwner && !m.isOwner) {
                  @if (m.role === 'admin') {
                    <button type="button" class="btn btn-quiet btn-sm" (click)="setRole(m, 'member')" [disabled]="busy()">Rebaixar</button>
                  } @else {
                    <button type="button" class="btn btn-quiet btn-sm" (click)="setRole(m, 'admin')" [disabled]="busy()">Tornar admin</button>
                  }
                }
                @if (g.canManage && !m.isOwner && m.user.relation !== 'self') {
                  <button type="button" class="btn btn-ghost btn-sm" (click)="removeMember(m)" [disabled]="busy()" [attr.aria-label]="'Remover ' + m.user.login">
                    <lt-icon name="close" [size]="15" />
                  </button>
                }
              </li>
            }
          </ul>

          @if (g.canManage) {
            <div class="mt-6">
              <h3 class="mb-2 text-sm font-bold tracking-wide uppercase text-muted">Configurações</h3>
              <div class="panel flex flex-wrap items-center gap-3 p-4">
                <span class="text-sm">Visibilidade:</span>
                <button type="button" class="btn btn-sm" [class.btn-primary]="g.visibility === 'closed'" [class.btn-ghost]="g.visibility !== 'closed'" (click)="setVisibility('closed')" [disabled]="busy()">
                  <lt-icon name="lock" [size]="14" /> Fechado
                </button>
                <button type="button" class="btn btn-sm" [class.btn-primary]="g.visibility === 'open'" [class.btn-ghost]="g.visibility !== 'open'" (click)="setVisibility('open')" [disabled]="busy()">
                  <lt-icon name="globe" [size]="14" /> Aberto
                </button>
              </div>
            </div>
          }
        </section>
      }
    } @else if (loading()) {
      <div class="card p-6"><lt-skeleton height="2rem" width="40%" /></div>
    } @else if (error(); as e) {
      <lt-empty icon="group" title="Grupo indisponível" [message]="e" />
    }
  `,
})
export class GroupDetailPage {
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly groupId = input.required<string>();

  protected readonly group = signal<FriendGroupDetail | null>(null);
  protected readonly games = signal<GroupGame[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<Tab>('shelf');

  // Shelf filters
  protected readonly query = signal('');
  protected readonly type = signal<GameTypeFilter>('all');
  protected readonly ownerFilter = signal('');
  protected readonly sort = signal<'name' | 'owners' | 'type'>('name');
  protected readonly dir = signal<'asc' | 'desc'>('asc');

  // Invite box
  protected readonly userQuery = signal('');
  protected readonly userResults = signal<PublicUser[]>([]);

  protected readonly typeFilters: Array<{ value: GameTypeFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'board', label: 'Tabuleiro' },
    { value: 'cards', label: 'Cartas' },
    { value: 'rpg', label: 'RPG' },
    { value: 'party', label: 'Festa' },
    { value: 'dice', label: 'Dados' },
    { value: 'abstract', label: 'Abstrato' },
    { value: 'children', label: 'Infantil' },
    { value: 'expansion', label: 'Expansão' },
  ];

  /**
   * Seats are assigned across all members (and any owners shown), so no two
   * people share a colour in this view — a collision would make the shelf lie.
   */
  protected readonly seats = computed(() =>
    assignSeats((this.group()?.members ?? []).map((m) => m.user.publicId)),
  );

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected typeLabel(type: string): string {
    return GAME_TYPE_LABELS[type as keyof typeof GAME_TYPE_LABELS] ?? type;
  }

  protected ownersLabel(row: GroupGame): string {
    return `Quem tem: ${row.owners.map((o) => o.displayName || o.login).join(', ')}`;
  }

  // --- Shelf filter handlers ---
  protected setSort(sort: 'name' | 'owners' | 'type'): void {
    this.sort.set(sort);
    void this.loadGames();
  }
  protected toggleDir(): void {
    this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    void this.loadGames();
  }
  protected setType(t: GameTypeFilter): void {
    this.type.set(t);
    void this.loadGames();
  }
  protected setOwner(id: string): void {
    this.ownerFilter.set(id);
    void this.loadGames();
  }
  protected reloadGames(): void {
    void this.loadGames();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [group] = await Promise.all([this.social.group(this.groupId()), this.loadGames()]);
      this.group.set(group);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar o grupo.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadGames(): Promise<void> {
    const page = await this.social.groupGames(this.groupId(), {
      sort: this.sort(),
      dir: this.dir(),
      type: this.type(),
      pageSize: 100,
      ...(this.query().trim() ? { q: this.query().trim() } : {}),
      ...(this.ownerFilter() ? { ownerId: this.ownerFilter() } : {}),
    });
    this.games.set(page.items);
    this.total.set(page.total);
  }

  /** Reload only the group detail (members/roles) after a management action. */
  private async refreshGroup(detail?: FriendGroupDetail): Promise<void> {
    this.group.set(detail ?? (await this.social.group(this.groupId())));
  }

  // --- Management actions ---
  private async manage(action: () => Promise<FriendGroupDetail | void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const detail = await action();
      await this.refreshGroup(detail ?? undefined);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async searchUsers(): Promise<void> {
    const q = this.userQuery().trim();
    if (q.length < 2) return;
    try {
      const page = await this.social.searchUsers(q);
      // Hide people already in the group in any status.
      const taken = new Set([
        ...(this.group()?.members ?? []).map((m) => m.user.publicId),
        ...(this.group()?.invited ?? []).map((m) => m.user.publicId),
        ...(this.group()?.requests ?? []).map((m) => m.user.publicId),
      ]);
      this.userResults.set(page.items.filter((u) => !taken.has(u.publicId)));
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível buscar.');
    }
  }

  protected async invite(user: PublicUser): Promise<void> {
    await this.manage(() => this.social.inviteMembers(this.groupId(), [user.publicId]));
    this.userResults.update((rs) => rs.filter((u) => u.publicId !== user.publicId));
  }

  protected async approve(m: GroupMember): Promise<void> {
    await this.manage(() => this.social.approveRequest(this.groupId(), m.user.publicId));
  }

  protected async removeMember(m: GroupMember): Promise<void> {
    await this.manage(() => this.social.removeMember(this.groupId(), m.user.publicId));
  }

  protected async setRole(m: GroupMember, role: 'admin' | 'member'): Promise<void> {
    await this.manage(() => this.social.setMemberRole(this.groupId(), m.user.publicId, role));
  }

  protected async setVisibility(visibility: 'open' | 'closed'): Promise<void> {
    await this.manage(() => this.social.updateGroup(this.groupId(), { visibility }));
  }

  protected async leave(): Promise<void> {
    const me = this.auth.user()?.publicId;
    if (!me || !confirm('Sair deste grupo?')) return;
    this.busy.set(true);
    try {
      await this.social.removeMember(this.groupId(), me);
      await this.router.navigateByUrl('/grupos');
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível sair.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeGroup(): Promise<void> {
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
