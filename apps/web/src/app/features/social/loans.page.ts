import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Loan, LoanStatus, PublicUser } from '@ludoteca/shared';
import { ApiFailure } from '../../core/api.service';
import { ListsService } from '../../core/lists.service';
import { SocialService } from '../../core/social.service';
import { EmptyState, SeatToken, Skeleton } from '../../shared/ui';

const STATUS_LABEL: Record<LoanStatus, string> = {
  requested: 'Aguardando',
  active: 'Emprestado',
  returned: 'Devolvido',
};

@Component({
  selector: 'lt-loans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SeatToken, Skeleton, EmptyState],
  template: `
    <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl">Empréstimos</h1>
        <p class="mt-1 text-sm text-muted">Quem está com o quê, e desde quando.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" (click)="lending.set(!lending())" [disabled]="friends().length === 0">
        Emprestar jogo
      </button>
    </header>

    @if (lending()) {
      <form class="panel mb-5 p-4" (ngSubmit)="lend()">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="loan-game">Jogo</label>
            <select id="loan-game" class="field" [(ngModel)]="gameId" name="gameId">
              <option value="">Escolha um jogo…</option>
              @for (option of myGames(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
            <p class="hint mt-1">Só jogos da sua coleção.</p>
          </div>
          <div>
            <label class="label" for="loan-friend">Para quem</label>
            <select id="loan-friend" class="field" [(ngModel)]="friendId" name="friendId">
              <option value="">Escolha um amigo…</option>
              @for (friend of friends(); track friend.publicId) {
                <option [value]="friend.publicId">{{ friend.displayName || friend.login }}</option>
              }
            </select>
          </div>
        </div>
        <div class="mt-4 flex gap-2">
          <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !gameId() || !friendId()">Emprestar</button>
          <button type="button" class="btn btn-quiet btn-sm" (click)="lending.set(false)">Cancelar</button>
        </div>
      </form>
    }

    <div class="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar empréstimos">
      @for (f of filters; track f.value) {
        <button
          type="button"
          class="chip"
          [class.chip-active]="status() === f.value"
          (click)="setStatus(f.value)"
          [attr.aria-pressed]="status() === f.value"
        >
          {{ f.label }}
        </button>
      }
    </div>

    @if (error(); as e) {
      <p role="alert" class="mb-4 text-sm" style="color: var(--color-danger)">{{ e }}</p>
    }

    @if (loading()) {
      <ul class="grid gap-3">
        @for (i of [1, 2]; track i) {
          <li class="card p-3"><lt-skeleton height="1.5rem" width="50%" /></li>
        }
      </ul>
    } @else if (loans().length === 0) {
      <lt-empty icon="📦" title="Nada emprestado" message="Quando você emprestar um jogo — ou pegar um emprestado — ele aparece aqui." />
    } @else {
      <ul class="grid gap-3">
        @for (loan of loans(); track loan.publicId; let i = $index) {
          <li class="card animate-rise flex flex-wrap items-center gap-3 p-3" [style.animation-delay.ms]="i * 25">
            @if (loan.game.thumbnail) {
              <img [src]="loan.game.thumbnail" alt="" class="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" style="background: var(--surface-sunken)" />
            } @else {
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-lg" style="background: var(--surface-sunken)" aria-hidden="true">🎲</span>
            }

            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-strong">{{ loan.game.name }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
                @if (loan.role === 'lending') {
                  <span>Com</span>
                  <lt-seat [user]="loan.borrower" />
                  <span class="truncate">{{ loan.borrower.displayName || loan.borrower.login }}</span>
                } @else {
                  <span>De</span>
                  <lt-seat [user]="loan.lender" />
                  <span class="truncate">{{ loan.lender.displayName || loan.lender.login }}</span>
                }
              </p>
            </div>

            <span class="chip" [class.chip-active]="loan.status === 'active'">{{ statusLabel(loan.status) }}</span>

            <!-- Only the owner approves a borrow request; either side can close it. -->
            @if (loan.status === 'requested' && loan.role === 'lending') {
              <button type="button" class="btn btn-primary btn-sm" (click)="setStatusOf(loan, 'active')" [disabled]="busy()">Aprovar</button>
            }
            @if (loan.status !== 'returned') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="setStatusOf(loan, 'returned')" [disabled]="busy()">
                {{ loan.status === 'requested' ? 'Cancelar' : 'Devolvido' }}
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class LoansPage {
  private readonly social = inject(SocialService);
  private readonly listsService = inject(ListsService);

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
    return STATUS_LABEL[status];
  }

  protected setStatus(status: 'all' | 'active' | 'requested' | 'returned'): void {
    this.status.set(status);
    void this.load();
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
    this.error.set(null);
    try {
      await this.social.createLoan({
        gameId: this.gameId(),
        counterpartId: this.friendId(),
        intent: 'lend',
      });
      this.lending.set(false);
      this.gameId.set('');
      this.friendId.set('');
      await this.load();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível registrar o empréstimo.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatusOf(loan: Loan, status: 'active' | 'returned'): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.social.setLoanStatus(loan.publicId, status);
      await this.load();
    } catch (err) {
      this.error.set(err instanceof ApiFailure ? err.message : 'Não foi possível atualizar o empréstimo.');
    } finally {
      this.busy.set(false);
    }
  }
}
