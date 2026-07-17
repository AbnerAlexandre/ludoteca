import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ThemeService } from '../core/theme.service';
import { Icon, type IconName } from '../shared/icon';
import { SeatToken } from '../shared/ui';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

/**
 * The app frame. Two navigations, one source of truth: a labelled rail on
 * desktop and a thumb-reachable tab bar on mobile. The mobile bar carries the
 * five primary destinations; "Conta" lives in the header on small screens so
 * the bar never crowds past comfortable touch targets.
 */
@Component({
  selector: 'lt-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SeatToken, Icon],
  template: `
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--color-brand-600)] focus:px-4 focus:py-2 focus:text-white"
      >Pular para o conteúdo</a
    >

    <div class="flex min-h-dvh flex-col">
      <header
        class="sticky top-0 z-30 border-b border-subtle backdrop-blur"
        style="background: color-mix(in srgb, var(--surface-page) 88%, transparent)"
      >
        <div class="container-app flex h-16 items-center gap-3">
          <a routerLink="/colecao" class="flex items-center gap-2.5" aria-label="Ludoteca, início">
            <!-- The mark is a die face: six pips, the six seats. -->
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style="background: var(--color-brand-600)"
              aria-hidden="true"
            >
              <span class="grid grid-cols-2 gap-[3px]">
                @for (pip of pips; track $index) {
                  <span class="h-[3px] w-[3px] rounded-full bg-white"></span>
                }
              </span>
            </span>
            <span class="font-display text-lg font-extrabold tracking-tight text-strong">Ludoteca</span>
          </a>

          <div class="flex-1"></div>

          <button type="button" class="btn btn-quiet btn-icon" (click)="theme.toggle()" [attr.aria-label]="themeLabel()">
            <lt-icon [name]="themeIcon()" />
          </button>

          <a routerLink="/conta" class="lg:hidden" aria-label="Conta">
            @if (user(); as u) {
              <lt-seat [user]="u" />
            }
          </a>
        </div>
      </header>

      <div class="container-app flex flex-1 gap-8 py-6">
        <!-- Desktop rail. Hidden on mobile, where the tab bar takes over.
             The sticky element wraps the WHOLE rail — links and account card
             together. Sticking only the list left the account card outside the
             stuck element, so it scrolled up under the page content. -->
        <nav class="hidden w-52 shrink-0 lg:block" aria-label="Navegação principal">
          <div class="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto">
            <ul class="space-y-1">
              @for (item of nav; track item.path) {
                <li>
                  <a
                    [routerLink]="item.path"
                    routerLinkActive="nav-active"
                    class="nav-link"
                    #rla="routerLinkActive"
                    [attr.aria-current]="rla.isActive ? 'page' : null"
                  >
                    <lt-icon [name]="item.icon" />
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>

            @if (user(); as u) {
              <a routerLink="/conta" routerLinkActive="nav-active" class="nav-link mt-6 gap-2.5">
                <lt-seat [user]="u" />
                <span class="min-w-0 flex-1 truncate">{{ u.displayName || u.login }}</span>
              </a>
            }
          </div>
        </nav>

        <main id="conteudo" class="min-w-0 flex-1 pb-24 lg:pb-0">
          <router-outlet />
        </main>
      </div>

      <!-- Mobile tab bar. safe-area padding keeps it clear of the home indicator. -->
      <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-subtle lg:hidden"
        style="background: var(--surface-card); padding-bottom: env(safe-area-inset-bottom)"
        aria-label="Navegação principal"
      >
        <ul class="grid grid-cols-5">
          @for (item of nav; track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive="tab-active"
                class="tab-link"
                #rla="routerLinkActive"
                [attr.aria-current]="rla.isActive ? 'page' : null"
              >
                <lt-icon [name]="item.icon" [size]="21" />
                <span class="text-[0.625rem] font-semibold">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    </div>
  `,
  styles: [
    `
      .nav-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-radius: 0.75rem;
        padding: 0.625rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-muted);
        transition:
          background-color 140ms ease,
          color 140ms ease;
      }
      .nav-link:hover {
        background: var(--surface-sunken);
        color: var(--text-strong);
      }
      .nav-link.nav-active {
        background: color-mix(in srgb, var(--color-brand-500) 14%, transparent);
        color: var(--color-brand-500);
      }

      .tab-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        /* 56px keeps every tab a comfortable thumb target. */
        min-height: 3.5rem;
        color: var(--text-muted);
        transition: color 140ms ease;
      }
      .tab-link.tab-active {
        color: var(--color-brand-500);
      }
    `,
  ],
})
export class AppShell {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthStore);

  protected readonly user = this.auth.user;
  protected readonly pips = Array.from({ length: 6 });

  protected readonly nav: NavItem[] = [
    { path: '/colecao', label: 'Listas', icon: 'dice' },
    { path: '/buscar', label: 'Buscar', icon: 'search' },
    { path: '/grupos', label: 'Grupos', icon: 'group' },
    { path: '/amigos', label: 'Amigos', icon: 'friends' },
    { path: '/emprestimos', label: 'Empréstimos', icon: 'loan' },
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
}
