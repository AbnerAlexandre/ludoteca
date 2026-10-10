import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from '../core/auth.store';
import { SocialService } from '../core/social.service';
import { ThemeService } from '../core/theme.service';
import { Icon, type IconName } from '../shared/icon';
import { Menu } from '../shared/menu';
import { SeatToken } from '../shared/ui';

type AttentionKey = 'friends' | 'groups' | 'loans';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** Which "waiting on you" counter shows on this item, if any. */
  attention?: AttentionKey;
  /** Other path prefixes that belong to this section (a list lives under /listas). */
  also?: string[];
}

/**
 * The app frame.
 *
 * Desktop: one horizontal bar — logo, the five destinations, a quick search and
 * the account menu. The old left rail is gone, so lists and shelves get the
 * full width they actually need.
 *
 * Phone: a slim header (logo, theme, account) and a thumb-reachable tab bar.
 * Both carry a counter for what's waiting on the user — a friend request, a
 * group invite, a borrow request to approve — so nothing sits unseen behind a
 * tab.
 *
 * The header and tab bar have their own view-transition names, so they hold
 * still while only the page content cross-fades between routes.
 */
@Component({
  selector: 'lt-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, FormsModule, SeatToken, Icon, Menu],
  template: `
    <header class="app-header">
      <div class="container-app flex h-16 items-center gap-1.5">
        <a routerLink="/colecao" class="logo mr-1 shrink-0 lg:mr-5" aria-label="Ludoteca, início">
          <img src="/bdsmlogo.png" alt="" class="h-9 w-auto" />
        </a>

        <nav class="hidden items-center gap-0.5 lg:flex" aria-label="Navegação principal">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              [class.is-active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null"
              class="top-link"
            >
              <lt-icon [name]="item.icon" [size]="18" />
              {{ item.label }}
              @if (item.attention && attention()[item.attention] > 0) {
                <span class="badge" [attr.aria-label]="attention()[item.attention] + ' pendente(s)'">{{ attention()[item.attention] }}</span>
              }
            </a>
          }
        </nav>

        <div class="flex-1"></div>

        <form class="search-box mr-1 hidden w-56 xl:flex" role="search" (ngSubmit)="quickSearch()">
          <lt-icon name="search" [size]="16" />
          <label class="sr-only" for="quick-q">Buscar jogo no catálogo</label>
          <input id="quick-q" class="field field-sm" [(ngModel)]="quickQuery" name="q" placeholder="Buscar jogo…" maxlength="80" autocomplete="off" />
        </form>

        <button type="button" class="btn btn-quiet btn-icon" (click)="theme.toggle()" [attr.aria-label]="themeLabel()" [title]="themeLabel()">
          <lt-icon [name]="themeIcon()" [size]="19" />
        </button>

        @if (user(); as u) {
          <lt-menu triggerClass="avatar-btn" label="Menu da conta" [heading]="'@' + u.login">
            <span trigger class="inline-flex"><lt-seat [user]="u" /></span>
            <a class="menu-item" [routerLink]="['/perfil', u.publicId]"><lt-icon name="user" [size]="18" /> Meu perfil</a>
            <a class="menu-item" routerLink="/conta"><lt-icon name="settings" [size]="18" /> Conta e privacidade</a>
            <div class="menu-sep" role="separator"></div>
            <button type="button" class="menu-item" (click)="logout()"><lt-icon name="logout" [size]="18" /> Sair</button>
          </lt-menu>
        }
      </div>
    </header>

    <main id="conteudo" class="container-app pt-6 pb-32 sm:pt-9 lg:pb-20">
      <router-outlet />
    </main>

    <nav class="tabbar lg:hidden" aria-label="Navegação principal">
      <ul class="grid grid-cols-5">
        @for (item of nav; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              [class.is-active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null"
              class="tab-link"
            >
              <span class="tab-icon">
                <lt-icon [name]="item.icon" [size]="21" />
                @if (item.attention && attention()[item.attention] > 0) {
                  <span class="tab-dot" [attr.aria-label]="attention()[item.attention] + ' pendente(s)'"></span>
                }
              </span>
              <span class="tab-label">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
      }

      .app-header {
        position: sticky;
        top: 0;
        z-index: 40;
        view-transition-name: app-header;
        background: color-mix(in srgb, var(--paper) 86%, transparent);
        backdrop-filter: blur(14px) saturate(1.3);
        -webkit-backdrop-filter: blur(14px) saturate(1.3);
        border-bottom: 1px solid var(--line);
        padding-top: env(safe-area-inset-top);
      }
      .logo {
        transition: transform var(--dur-base) var(--ease-spring);
      }
      .logo:hover {
        transform: rotate(-3deg) scale(1.04);
      }

      .top-link {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        height: 38px;
        padding: 0 0.8rem;
        border-radius: var(--r);
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--ink-3);
        transition:
          background-color var(--dur-fast) ease,
          color var(--dur-fast) ease;
      }
      .top-link:hover {
        color: var(--ink);
        background: var(--surface-2);
      }
      .top-link.is-active {
        color: var(--ink);
        background: var(--surface);
        box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
      }
      .top-link.is-active lt-icon {
        color: var(--brand-text);
      }

      :host ::ng-deep .avatar-btn {
        display: inline-grid;
        place-items: center;
        width: var(--tap);
        height: var(--tap);
        border: 0;
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
        transition: transform var(--dur-press) var(--ease-out);
      }
      :host ::ng-deep .avatar-btn:active {
        transform: scale(0.94);
      }
      :host ::ng-deep .avatar-btn[aria-expanded='true'] .seat {
        box-shadow:
          inset 0 -2px 0 rgb(0 0 0 / 0.2),
          0 0 0 2px var(--brand);
      }

      .tabbar {
        position: fixed;
        inset-inline: 0;
        bottom: 0;
        z-index: 40;
        view-transition-name: app-tabbar;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        backdrop-filter: blur(14px) saturate(1.3);
        -webkit-backdrop-filter: blur(14px) saturate(1.3);
        border-top: 1px solid var(--line);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .tab-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        /* 64px: um alvo de toque folgado em cada aba */
        min-height: var(--tabbar-h);
        color: var(--ink-3);
        transition: color var(--dur-fast) ease;
      }
      .tab-icon {
        position: relative;
        display: grid;
        place-items: center;
        width: 3.4rem;
        height: 1.9rem;
        border-radius: 999px;
        transition:
          background-color var(--dur-base) var(--ease-out),
          transform var(--dur-press) var(--ease-out);
      }
      .tab-link:active .tab-icon {
        transform: scale(0.92);
      }
      .tab-label {
        font-size: 0.66rem;
        font-weight: 650;
        letter-spacing: 0.01em;
      }
      .tab-link.is-active {
        color: var(--ink);
      }
      .tab-link.is-active .tab-icon {
        background: var(--brand-soft);
        color: var(--brand-text);
      }
      .tab-dot {
        position: absolute;
        top: 2px;
        right: 0.85rem;
        width: 8px;
        height: 8px;
        border-radius: 99px;
        background: var(--brand);
        box-shadow: 0 0 0 2px var(--surface);
      }
    `,
  ],
})
export class AppShell {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthStore);
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly quickQuery = signal('');
  protected readonly attention = signal<Record<AttentionKey, number>>({ friends: 0, groups: 0, loans: 0 });

  protected readonly nav: NavItem[] = [
    { path: '/colecao', label: 'Listas', icon: 'dice', also: ['/listas'] },
    { path: '/buscar', label: 'Buscar', icon: 'search' },
    { path: '/grupos', label: 'Grupos', icon: 'group', attention: 'groups' },
    { path: '/amigos', label: 'Amigos', icon: 'friends', attention: 'friends' },
    { path: '/emprestimos', label: 'Empréstimos', icon: 'loan', attention: 'loans' },
  ];

  protected readonly themeIcon = computed<IconName>(
    () => (({ light: 'sun', dark: 'moon', system: 'monitor' }) as const)[this.theme.choice()],
  );

  protected readonly themeLabel = computed(
    () =>
      ({
        light: 'Tema claro. Trocar para escuro.',
        dark: 'Tema escuro. Trocar para o do sistema.',
        system: 'Tema do sistema. Trocar para claro.',
      })[this.theme.choice()],
  );

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private lastRefresh = 0;

  constructor() {
    void this.refreshAttention();
    // Counts drift as the user acts (accepts, approves), so re-check on
    // navigation — throttled, it's three small requests.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.refreshAttention());
  }

  protected isActive(item: NavItem): boolean {
    const path = this.url().split(/[?#]/)[0]!;
    return [item.path, ...(item.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
  }

  protected quickSearch(): void {
    const q = this.quickQuery().trim();
    if (q.length < 2) return;
    void this.router.navigate(['/buscar'], { queryParams: { q } });
    this.quickQuery.set('');
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/entrar');
  }

  private async refreshAttention(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh < 8000) return;
    this.lastRefresh = now;
    try {
      const [requests, invites, loans] = await Promise.all([
        this.social.requests(),
        this.social.groupInvites(),
        this.social.loans({ status: 'requested' }),
      ]);
      this.attention.set({
        friends: requests.filter((r) => r.direction === 'incoming').length,
        groups: invites.length,
        // Only requests the user has to answer: someone wants to borrow theirs.
        loans: loans.items.filter((l) => l.role === 'lending').length,
      });
    } catch {
      // Cosmetic: a failed count just leaves the badges as they were.
    }
  }
}
