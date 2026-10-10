import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Loan, LoanStatus, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { FeedbackService } from '../../core/feedback.service';
import { ListsService } from '../../core/lists.service';
import { SocialService } from '../../core/social.service';
import { Icon } from '../../shared/icon';
import { Sheet } from '../../shared/sheet';
import { Cover, EmptyState, PageHead, SeatToken, Skeleton } from '../../shared/ui';

const STATUS: Record<LoanStatus, { label: string; tag: string }> = {
  requested: { label: 'Aguardando', tag: 'tag-brand' },
  active: { label: 'Emprestado', tag: 'tag-amber' },
  returned: { label: 'Devolvido', tag: 'tag-mint' },
};

@Component({
  selector: 'lt-loans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, SeatToken, Skeleton, EmptyState, Icon, Cover, Sheet, PageHead],
  template: `
    <lt-page-head eyebrow="Quem está com o quê" title="Empréstimos" subtitle="Emprestou o Catan e esqueceu para quem? Fica tudo anotado aqui.">
      <button type="button" class="btn btn-primary" (click)="startLend()" [disabled]="friends().length === 0" [title]="friends().length === 0 ? 'Adicione um amigo para emprestar' : ''">
        <lt-icon name="loan" [size]="18" /> Emprestar jogo
      </button>
    </lt-page-head>

    <div class="rail rail-bleed rise mb-6" style="--i: 2">
      <div class="seg" role="group" aria-label="Filtrar empréstimos">
        @for (f of filters; track f.value) {
          <button type="button" [attr.aria-pressed]="status() === f.value" (click)="setStatus(f.value)">{{ f.label }}</button>
        }
      </div>
    </div>

    @if (error(); as e) {
      <p role="alert" class="notice notice-danger mb-5">{{ e }}</p>
    }

    @if (loading()) {
      <div class="rows">
        @for (i of [1, 2, 3]; track i) {
          <div class="row"><lt-skeleton height="3.5rem" width="3.5rem" /><div class="flex-1"><lt-skeleton height="1rem" width="45%" /></div></div>
        }
      </div>
    } @else if (loans().length === 0) {
      <lt-empty title="Nada por aqui" message="Quando você emprestar um jogo — ou pegar um emprestado — ele aparece aqui, com quem está e desde quando.">
        @if (friends().length > 0 && status() === 'all') {
          <button type="button" class="btn btn-primary" (click)="startLend()">Emprestar um jogo</button>
        }
      </lt-empty>
    } @else {
      <ul class="rows">
        @for (loan of loans(); track loan.publicId; let i = $index) {
          <li class="row fade-in flex-wrap sm:flex-nowrap" [style.--i]="i">
            <a [routerLink]="['/jogos', loan.game.publicId]" class="flex min-w-0 flex-1 items-center gap-3.5">
              <lt-cover class="h-14 w-14" [src]="loan.game.thumbnail" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-ink">{{ loan.game.name }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                  <span class="tag" [class]="'tag ' + statusTag(loan.status)">{{ statusLabel(loan.status) }}</span>
                  <span class="inline-flex min-w-0 items-center gap-1.5">
                    {{ loan.role === 'lending' ? 'com' : 'de' }}
                    <lt-seat [user]="loan.role === 'lending' ? loan.borrower : loan.lender" size="sm" />
                    <span class="truncate font-semibold text-ink-2">{{ nameOf(loan.role === 'lending' ? loan.borrower : loan.lender) }}</span>
                  </span>
                  <span class="meta">· {{ since(loan) }}</span>
                </span>
              </span>
            </a>

            <!-- Only the owner approves a borrow request; either side can close it. -->
            <div class="flex w-full justify-end gap-2 sm:w-auto">
              @if (loan.status === 'requested' && loan.role === 'lending') {
                <button type="button" class="btn btn-primary btn-sm" (click)="setStatusOf(loan, 'active')" [disabled]="busy()">Aprovar</button>
              }
              @if (loan.status !== 'returned') {
                <button type="button" class="btn btn-ghost btn-sm" (click)="setStatusOf(loan, 'returned')" [disabled]="busy()">
                  @if (loan.status === 'requested') {
                    Cancelar
                  } @else {
                    <lt-icon name="check" [size]="15" /> Devolvido
                  }
                </button>
              }
            </div>
          </li>
        }
      </ul>
    }

    <lt-sheet [open]="lending()" heading="Emprestar um jogo" eyebrow="Fica anotado" (closed)="lending.set(false)">
      <form (ngSubmit)="lend()" class="grid gap-5">
        <div>
          <label class="label" for="loan-game">Qual jogo</label>
          <select id="loan-game" class="field" [(ngModel)]="gameId" name="gameId">
            <option value="">Escolha um jogo da sua coleção…</option>
            @for (option of myGames(); track option.id) {
              <option [value]="option.id">{{ option.name }}</option>
            }
          </select>
          @if (myGames().length === 0) {
            <p class="hint mt-1.5">Sua coleção está vazia — adicione jogos a ela primeiro.</p>
          }
        </div>
        <div>
          <p class="label">Para quem</p>
          <div class="grid max-h-56 gap-1 overflow-y-auto" role="radiogroup" aria-label="Amigo">
            @for (friend of friends(); track friend.publicId) {
              <label class="choice items-center py-2">
                <input type="radio" name="friendId" class="mt-0!" [value]="friend.publicId" [ngModel]="friendId()" (ngModelChange)="friendId.set($event)" />
                <lt-seat [user]="friend" size="sm" />
                <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ friend.displayName || friend.login }}</span>
              </label>
            }
          </div>
        </div>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-ghost" (click)="lending.set(false)">Cancelar</button>
          <button type="submit" class="btn btn-primary" [disabled]="busy() || !gameId() || !friendId()">
            {{ busy() ? 'Salvando…' : 'Emprestar' }}
          </button>
        </div>
      </form>
    </lt-sheet>
  `,
})
export class LoansPage {
  private readonly social = inject(SocialService);
  private readonly listsService = inject(ListsService);
  private readonly feedback = inject(FeedbackService);

  protected readonly filters = [
    { value: 'all' as const, label: 'Todos' },
    { value: 'active' as const, label: 'Emprestados' },
    { value: 'requested' as const, label: 'Aguardando' },
    { value: 'returned' as const, label: 'Devolvidos' },
  ];

  protected readonly loans = signal<Loan[]>([]);
  protected readonly friends = signal<PublicUser[]>([]);
  protected readonly myGames = signal<Array<{ id: string; name: string }>>([]);
  protected readonly status = signal<'all' | 'active' | 'requested' | 'returned'>('all');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly lending = signal(false);
  protected readonly gameId = signal('');
  protected readonly friendId = signal('');
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
    void this.loadLendables();
  }

  protected statusLabel(status: LoanStatus): string {
    return STATUS[status].label;
  }

  protected statusTag(status: LoanStatus): string {
    return STATUS[status].tag;
  }

  protected nameOf(user: PublicUser): string {
    return user.displayName || user.login;
  }

  /** "há 12 dias" from when it actually changed hands (or was asked for). */
  protected since(loan: Loan): string {
    const iso = loan.status === 'returned' ? loan.returnedAt : (loan.startedAt ?? loan.requestedAt);
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    const when = days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
    return loan.status === 'returned' ? `devolvido ${when}` : when;
  }

  protected setStatus(status: 'all' | 'active' | 'requested' | 'returned'): void {
    this.status.set(status);
    void this.load();
  }

  protected startLend(): void {
    this.gameId.set('');
    this.friendId.set('');
    this.lending.set(true);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.social.loans({ status: this.status() });
      this.loans.set(page.items);
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível carregar os empréstimos.');
    } finally {
      this.loading.set(false);
    }
  }

  /** The lend form needs the caller's collection and their friends. */
  private async loadLendables(): Promise<void> {
    try {
      const [friends, lists] = await Promise.all([this.social.friends(), this.listsService.lists()]);
      this.friends.set(friends.items);

      const collection = lists.find((l) => l.kind === 'collection');
      if (!collection) return;
      const items = await this.listsService.items(collection.publicId, { pageSize: 100, sort: 'name', dir: 'asc' });
      this.myGames.set(items.items.map((i) => ({ id: i.game.publicId, name: i.game.name })));
    } catch {
      // Non-fatal: the list still renders, the lend form just stays empty.
    }
  }

  protected async lend(): Promise<void> {
    if (!this.gameId() || !this.friendId()) return;
    this.busy.set(true);
    try {
      await this.social.createLoan({ gameId: this.gameId(), counterpartId: this.friendId(), intent: 'lend' });
      const game = this.myGames().find((g) => g.id === this.gameId())?.name ?? 'Jogo';
      const friend = this.friends().find((f) => f.publicId === this.friendId());
      this.lending.set(false);
      this.feedback.success(`${game} emprestado para ${friend ? this.nameOf(friend) : 'seu amigo'}.`);
      await this.load();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível registrar o empréstimo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatusOf(loan: Loan, status: 'active' | 'returned'): Promise<void> {
    this.busy.set(true);
    try {
      await this.social.setLoanStatus(loan.publicId, status);
      this.feedback.success(
        status === 'active' ? `Empréstimo de ${loan.game.name} aprovado.` : `${loan.game.name} marcado como devolvido.`,
      );
      await this.load();
    } catch (err) {
      this.feedback.error(err instanceof ApiFailure ? err.message : 'Não foi possível atualizar o empréstimo.');
    } finally {
      this.busy.set(false);
    }
  }
}
