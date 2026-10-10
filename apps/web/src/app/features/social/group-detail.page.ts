import { ChangeDetectionStrategy, Component, type OnDestroy, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  GAME_TYPE_LABELS,
  type FriendGroupDetail,
  type GameTypeFilter,
  type GroupGame,
  type GroupMember,
  type PublicUser,
} from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { FeedbackService } from '../../core/feedback.service';
import { assignSeats } from '../../core/seat';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Menu } from '../../shared/menu';
import { Cover, EmptyState, SeatToken, Skeleton } from '../../shared/ui';

type Tab = 'shelf' | 'members';

/**
 * A group's page: the aggregated shelf (the seat-colour signature) plus member
 * management. Admins invite/remove and handle join requests; the owner also
 * promotes/demotes and can delete the group.
 *
 * Filtering by person is a row of their tokens rather than a dropdown: the
 * same colours that mark ownership on every row are what you tap to narrow
 * the shelf, so the legend and the filter are one thing.
 */
@Component({
  selector: 'lt-group-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Skeleton, EmptyState, Icon, Menu, Cover],
  template: `
    <a routerLink="/grupos" class="back-link"><lt-icon name="arrow-left" [size]="16" /> Grupos</a>

    @if (group(); as g) {
      <header class="rise mb-7 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="eyebrow mb-2.5 flex items-center gap-1.5">
            <lt-icon [name]="g.visibility === 'open' ? 'globe' : 'lock'" [size]="12" />
            Grupo {{ g.visibility === 'open' ? 'aberto' : 'fechado' }}
          </p>
          <h1 class="display text-[2.15rem] sm:text-[2.75rem]">{{ g.name }}</h1>
          <div class="mt-4 flex items-center gap-3">
            <div class="seat-stack">
              @for (member of g.members; track member.user.publicId) {
                <lt-seat [user]="member.user" [seat]="seats().get(member.user.publicId)" />
              }
            </div>
            <span class="text-sm text-ink-3"><span class="stat text-ink">{{ g.memberCount }}</span> {{ g.memberCount === 1 ? 'membro' : 'membros' }}</span>
          </div>
        </div>
        <lt-menu triggerClass="btn btn-ghost btn-icon" label="Opções do grupo">
          <lt-icon trigger name="more" [size]="19" />
          @if (g.isOwner) {
            <button type="button" class="menu-item menu-item-danger" (click)="removeGroup()"><lt-icon name="trash" [size]="17" /> Excluir grupo</button>
          } @else {
            <button type="button" class="menu-item menu-item-danger" (click)="leave()"><lt-icon name="logout" [size]="17" /> Sair do grupo</button>
          }
        </lt-menu>
      </header>

      <div class="seg rise mb-6" style="--i: 1" role="tablist" aria-label="Seções do grupo">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'shelf'" (click)="tab.set('shelf')">
          <lt-icon name="dice" [size]="16" /> Estante
        </button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'members'" (click)="tab.set('members')">
          <lt-icon name="users" [size]="16" /> Membros
          @if (g.canManage && g.requests.length > 0) {
            <span class="badge">{{ g.requests.length }}</span>
          }
        </button>
      </div>

      @if (error(); as e) {
        <p role="alert" class="notice notice-danger mb-4">{{ e }}</p>
      }

      <!-- ============================== SHELF ============================== -->
      @if (tab() === 'shelf') {
        <div class="fade-in mb-5 grid gap-3">
          <!-- Whose games: tap a token to narrow the shelf to that person. -->
          <div class="rail rail-bleed items-center" role="group" aria-label="Filtrar por membro">
            <button type="button" class="chip" [attr.aria-pressed]="!ownerFilter()" (click)="setOwner('')">Todos</button>
            @for (m of g.members; track m.user.publicId) {
              <button type="button" class="chip person-chip" [attr.aria-pressed]="ownerFilter() === m.user.publicId" (click)="setOwner(m.user.publicId)">
                <lt-seat [user]="m.user" [seat]="seats().get(m.user.publicId)" size="sm" />
                {{ firstName(m.user) }}
              </button>
            }
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="search-box min-w-[12rem] flex-1">
              <lt-icon name="search" [size]="17" />
              <label class="sr-only" for="gq">Filtrar jogos</label>
              <input id="gq" class="field field-sm" [ngModel]="query()" (ngModelChange)="onQuery($event)" placeholder="Filtrar jogos…" autocomplete="off" />
            </div>
            <label class="sr-only" for="gsort">Ordenar por</label>
            <select id="gsort" class="field field-sm w-auto" [ngModel]="sort()" (ngModelChange)="setSort($event)">
              <option value="name">Nome</option>
              <option value="owners">Quantos têm</option>
              <option value="type">Tipo</option>
            </select>
            <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="toggleDir()" [attr.aria-label]="dir() === 'asc' ? 'Crescente. Inverter.' : 'Decrescente. Inverter.'">
              <lt-icon [name]="dir() === 'asc' ? 'arrow-up' : 'arrow-down'" [size]="16" />
            </button>
          </div>

          <div class="rail rail-bleed" role="group" aria-label="Filtrar por tipo">
            @for (t of typeFilters; track t.value) {
              <button type="button" class="chip" [attr.aria-pressed]="type() === t.value" (click)="setType(t.value)">{{ t.label }}</button>
            }
          </div>
        </div>

        @if (gamesLoading()) {
          <div class="rows">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="row"><lt-skeleton height="3.5rem" width="3.5rem" /><div class="flex-1"><lt-skeleton height="1rem" width="40%" /></div></div>
            }
          </div>
        } @else if (games().length === 0) {
          <lt-empty title="Nenhum jogo à vista" message="Ajuste os filtros, ou espere os membros marcarem jogos como visíveis para você." />
        } @else {
          <p class="meta mb-3">{{ total() }} {{ total() === 1 ? 'jogo' : 'jogos' }} na estante</p>
          <ul class="rows">
            @for (row of games(); track row.game.publicId; let i = $index) {
              <li class="row row-hover fade-in" [style.--i]="i">
                <a [routerLink]="['/jogos', row.game.publicId]" class="flex min-w-0 flex-1 items-center gap-3.5">
                  <lt-cover class="h-14 w-14" [src]="row.game.thumbnail" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold text-ink">{{ row.game.name }}</span>
                    <span class="mt-1 flex flex-wrap items-center gap-2">
                      @if (row.game.year) {
                        <span class="meta">{{ row.game.year }}</span>
                      }
                      <span class="tag">{{ typeLabel(row.game.type) }}</span>
                    </span>
                  </span>
                </a>
                <div class="flex shrink-0 items-center gap-2" [attr.aria-label]="ownersLabel(row)" role="img">
                  <div class="seat-stack">
                    @for (owner of row.owners; track owner.publicId) {
                      <lt-seat [user]="owner" [seat]="seats().get(owner.publicId)" size="sm" />
                    }
                  </div>
                  @if (row.ownerCount > 1) {
                    <span class="meta hidden sm:inline">×{{ row.ownerCount }}</span>
                  }
                </div>
              </li>
            }
          </ul>
        }
      }

      <!-- ============================= MEMBERS ============================= -->
      @if (tab() === 'members') {
        <div class="fade-in grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div class="min-w-0 space-y-8">
            @if (g.canManage && g.requests.length > 0) {
              <section aria-labelledby="req-heading">
                <h2 id="req-heading" class="section-label eyebrow text-brand-text!">Pedidos para entrar <span class="badge">{{ g.requests.length }}</span></h2>
                <ul class="rows">
                  @for (m of g.requests; track m.user.publicId) {
                    <li class="row">
                      <lt-seat [user]="m.user" />
                      <a [routerLink]="['/perfil', m.user.publicId]" class="min-w-0 flex-1 truncate font-semibold text-ink hover:underline">{{ m.user.displayName || m.user.login }}</a>
                      <button type="button" class="btn btn-primary btn-sm" (click)="approve(m)" [disabled]="busy()">Aprovar</button>
                      <button type="button" class="btn btn-quiet btn-sm" (click)="removeMember(m)" [disabled]="busy()">Recusar</button>
                    </li>
                  }
                </ul>
              </section>
            }

            <section aria-labelledby="mem-heading">
              <h2 id="mem-heading" class="section-label eyebrow">Membros <span class="stat">{{ g.members.length }}</span></h2>
              <ul class="rows">
                @for (m of g.members; track m.user.publicId) {
                  <li class="row">
                    <lt-seat [user]="m.user" [seat]="seats().get(m.user.publicId)" />
                    <a [routerLink]="['/perfil', m.user.publicId]" class="min-w-0 flex-1">
                      <span class="block truncate font-semibold text-ink hover:underline">{{ m.user.displayName || m.user.login }}</span>
                      <span class="meta block truncate">{{ '@' + m.user.login }}</span>
                    </a>
                    @if (m.isOwner) {
                      <span class="tag tag-ink"><lt-icon name="crown" [size]="11" /> Dono</span>
                    } @else if (m.role === 'admin') {
                      <span class="tag tag-brand">Admin</span>
                    }
                    <!-- Owner changes roles and removes; admins remove members. -->
                    @if ((g.isOwner && !m.isOwner) || (g.canManage && !m.isOwner && m.user.relation !== 'self')) {
                      <lt-menu triggerClass="btn btn-quiet btn-sm btn-icon" [label]="'Opções para ' + m.user.login">
                        <lt-icon trigger name="more" [size]="18" />
                        @if (g.isOwner && !m.isOwner) {
                          @if (m.role === 'admin') {
                            <button type="button" class="menu-item" (click)="setRole(m, 'member')"><lt-icon name="user" [size]="17" /> Tornar membro comum</button>
                          } @else {
                            <button type="button" class="menu-item" (click)="setRole(m, 'admin')"><lt-icon name="crown" [size]="17" /> Tornar admin</button>
                          }
                        }
                        @if (g.canManage && !m.isOwner && m.user.relation !== 'self') {
                          <button type="button" class="menu-item menu-item-danger" (click)="removeMember(m, true)"><lt-icon name="close" [size]="17" /> Remover do grupo</button>
                        }
                      </lt-menu>
                    }
                  </li>
                }
              </ul>
            </section>

            @if (g.canManage && g.invited.length > 0) {
              <section aria-labelledby="inv-heading">
                <h2 id="inv-heading" class="section-label eyebrow">Convites pendentes</h2>
                <ul class="rows">
                  @for (m of g.invited; track m.user.publicId) {
                    <li class="row">
                      <lt-seat [user]="m.user" size="sm" />
                      <span class="min-w-0 flex-1 truncate text-sm text-ink-2">{{ m.user.displayName || m.user.login }}</span>
                      <span class="tag">Aguardando</span>
                      <button type="button" class="btn btn-quiet btn-sm" (click)="removeMember(m)" [disabled]="busy()">Cancelar</button>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>

          @if (g.canManage) {
            <aside class="min-w-0 space-y-8">
              <section aria-labelledby="invite-heading">
                <h2 id="invite-heading" class="section-label eyebrow">Convidar pessoas</h2>
                <form class="search-box" (ngSubmit)="searchUsers()" role="search">
                  <lt-icon name="search" [size]="17" />
                  <label class="sr-only" for="uq">Login ou nome</label>
                  <input id="uq" class="field" [(ngModel)]="userQuery" name="uq" placeholder="Login ou nome…" minlength="2" maxlength="80" autocomplete="off" enterkeyhint="search" />
                </form>
                @if (userResults().length > 0) {
                  <ul class="mt-3 grid gap-1">
                    @for (u of userResults(); track u.publicId; let i = $index) {
                      <li class="fade-in flex items-center gap-3 rounded-[var(--r)] p-2 hover:bg-surface-2" [style.--i]="i">
                        <lt-seat [user]="u" />
                        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ u.displayName || u.login }}</span>
                        <button type="button" class="btn btn-soft btn-sm" (click)="invite(u)" [disabled]="busy()">Convidar</button>
                      </li>
                    }
                  </ul>
                }
              </section>

              <section aria-labelledby="settings-heading">
                <h2 id="settings-heading" class="section-label eyebrow">Quem pode entrar</h2>
                <div class="seg w-full" role="group" aria-label="Visibilidade do grupo">
                  <button type="button" class="flex-1" [attr.aria-pressed]="g.visibility === 'closed'" (click)="setVisibility('closed')" [disabled]="busy()">
                    <lt-icon name="lock" [size]="14" /> Fechado
                  </button>
                  <button type="button" class="flex-1" [attr.aria-pressed]="g.visibility === 'open'" (click)="setVisibility('open')" [disabled]="busy()">
                    <lt-icon name="globe" [size]="14" /> Aberto
                  </button>
                </div>
                <p class="hint mt-2">
                  {{ g.visibility === 'open' ? 'Aparece em Explorar e qualquer pessoa pode pedir para entrar.' : 'Só entra quem for convidado.' }}
                </p>
              </section>
            </aside>
          }
        </div>
      }
    } @else if (loading()) {
      <div class="space-y-4">
        <lt-skeleton height="0.8rem" width="20%" />
        <lt-skeleton height="2.6rem" width="45%" />
        <lt-skeleton height="2rem" width="30%" />
      </div>
    } @else if (error(); as e) {
      <lt-empty title="Grupo indisponível" [message]="e">
        <a routerLink="/grupos" class="btn btn-ghost">Voltar aos grupos</a>
      </lt-empty>
    }
  `,
  styles: [
    `
      .person-chip {
        padding-left: 0.3rem;
      }
    `,
  ],
})
export class GroupDetailPage implements OnDestroy {
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);

  readonly groupId = input.required<string>();

  protected readonly group = signal<FriendGroupDetail | null>(null);
  protected readonly games = signal<GroupGame[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly gamesLoading = signal(true);
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
   * Seats are assigned across all members, so no two people share a colour in
   * this view — a collision would make the shelf lie.
   */
  protected readonly seats = computed(() => assignSeats((this.group()?.members ?? []).map((m) => m.user.publicId)));

  private queryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    queueMicrotask(() => void this.load());
  }

  ngOnDestroy(): void {
    clearTimeout(this.queryTimer);
  }

  protected typeLabel(type: string): string {
    return GAME_TYPE_LABELS[type as keyof typeof GAME_TYPE_LABELS] ?? type;
  }

  protected firstName(user: { displayName?: string | null; login: string }): string {
    return (user.displayName?.trim() || user.login).split(/\s+/)[0]!;
  }

  protected ownersLabel(row: GroupGame): string {
    return `Quem tem: ${row.owners.map((o) => o.displayName || o.login).join(', ')}`;
  }

  // --- Shelf filter handlers ---
  /** Server-side filter, so it waits for a pause in typing. */
  protected onQuery(value: string): void {
    this.query.set(value);
    clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => void this.loadGames(), 320);
  }
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
    this.gamesLoading.set(true);
    try {
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
    } finally {
      this.gamesLoading.set(false);
    }
  }

  /** Reload only the group detail (members/roles) after a management action. */
  private async refreshGroup(detail?: FriendGroupDetail): Promise<void> {
    this.group.set(detail ?? (await this.social.group(this.groupId())));
  }

  // --- Management actions ---
  private async manage(action: () => Promise<FriendGroupDetail | void>, success?: string): Promise<void> {
    this.busy.set(true);
    try {
      const detail = await action();
      await this.refreshGroup(detail ?? undefined);
      if (success) this.feedback.success(success);
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível concluir a ação.');
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
      const g = this.group();
      const taken = new Set([
        ...(g?.members ?? []).map((m) => m.user.publicId),
        ...(g?.invited ?? []).map((m) => m.user.publicId),
        ...(g?.requests ?? []).map((m) => m.user.publicId),
      ]);
      this.userResults.set(page.items.filter((u) => !taken.has(u.publicId)));
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível buscar.');
    }
  }

  protected async invite(user: PublicUser): Promise<void> {
    await this.manage(() => this.social.inviteMembers(this.groupId(), [user.publicId]), `Convite enviado para ${user.displayName || user.login}.`);
    this.userResults.update((rs) => rs.filter((u) => u.publicId !== user.publicId));
  }

  protected async approve(m: GroupMember): Promise<void> {
    await this.manage(() => this.social.approveRequest(this.groupId(), m.user.publicId), `${m.user.displayName || m.user.login} entrou no grupo.`);
  }

  protected async removeMember(m: GroupMember, ask = false): Promise<void> {
    if (ask) {
      const ok = await this.feedback.confirm({
        title: `Remover ${m.user.displayName || m.user.login}?`,
        message: 'Os jogos dessa pessoa saem da estante do grupo. Dá para convidar de novo depois.',
        confirmLabel: 'Remover',
        tone: 'danger',
      });
      if (!ok) return;
    }
    await this.manage(() => this.social.removeMember(this.groupId(), m.user.publicId));
  }

  protected async setRole(m: GroupMember, role: 'admin' | 'member'): Promise<void> {
    const name = m.user.displayName || m.user.login;
    await this.manage(
      () => this.social.setMemberRole(this.groupId(), m.user.publicId, role),
      role === 'admin' ? `${name} agora é admin.` : `${name} agora é membro comum.`,
    );
  }

  protected async setVisibility(visibility: 'open' | 'closed'): Promise<void> {
    if (this.group()?.visibility === visibility) return;
    await this.manage(() => this.social.updateGroup(this.groupId(), { visibility }));
  }

  protected async leave(): Promise<void> {
    const me = this.auth.user()?.publicId;
    if (!me) return;
    const ok = await this.feedback.confirm({
      title: 'Sair deste grupo?',
      message: 'Seus jogos saem da estante do grupo. Para voltar, você vai precisar de um convite ou de um pedido aprovado.',
      confirmLabel: 'Sair do grupo',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.social.removeMember(this.groupId(), me);
      this.feedback.toast(`Você saiu de ${this.group()?.name ?? 'o grupo'}.`);
      await this.router.navigateByUrl('/grupos');
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível sair.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeGroup(): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Excluir "${this.group()?.name}"?`,
      message: 'O grupo some para todos os membros. Os jogos e as amizades continuam intactos.',
      confirmLabel: 'Excluir grupo',
      tone: 'danger',
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.social.deleteGroup(this.groupId());
      this.feedback.toast('Grupo excluído.');
      await this.router.navigateByUrl('/grupos');
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível excluir o grupo.');
    } finally {
      this.busy.set(false);
    }
  }
}
