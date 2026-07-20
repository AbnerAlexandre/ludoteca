import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ThemeService } from '../../core/theme.service';

/**
 * Shared frame for login/register.
 *
 * The left panel is the hero and it states the thesis in the subject's own
 * language: six seats around a table, each a player colour. It's the same
 * system that identifies people throughout the app, shown here as the brand
 * idea rather than as decoration — so the first thing you see is the thing that
 * makes the group shelf readable later.
 */
@Component({
  selector: 'lt-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-dvh lg:grid-cols-2">
      <!-- Hero. Hidden on mobile: on a phone the form is the whole job. -->
      <aside
        class="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between"
        style="background: var(--color-ink-950)"
        aria-hidden="true"
      >
        <div
          class="absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style="background: var(--color-brand-600)"
        ></div>

        <div class="relative flex items-center">
          <img src="/bdsmlogo.png" alt="Ludoteca" class="h-11 w-auto" />
        </div>

        <div class="relative">
          <!-- The six seats, as they'd sit around a table. -->
          <div class="mb-10 flex">
            @for (seat of seats; track seat) {
              <span
                class="seat"
                [class]="'seat seat-' + seat"
                style="width: 3rem; height: 3rem; font-size: 1rem; border-color: var(--color-ink-950); margin-left: -0.75rem"
              >
                {{ seat }}
              </span>
            }
          </div>
          <h2 class="max-w-md text-5xl leading-[0.95] text-white">
            Todo jogo tem<br />
            uma cor.<br />
            <span style="color: var(--color-brand-400)">Todo jogador também.</span>
          </h2>
          <p class="mt-5 max-w-sm text-sm" style="color: var(--color-ink-300)">
            Cada pessoa ganha uma cor fixa. Numa mesa de amigos, você vê de relance quem tem cada jogo.
          </p>
        </div>

        <p class="relative text-xs" style="color: var(--color-ink-500)">
          Catálogo em parceria com a Ludopedia.
        </p>
      </aside>

      <main class="flex items-center justify-center px-5 py-12 sm:px-10">
        <div class="w-full max-w-sm animate-rise">
          <p class="mb-2 text-xs font-bold tracking-widest uppercase" style="color: var(--color-brand-500)">
            {{ eyebrow() }}
          </p>
          <h1 class="mb-2 text-3xl">{{ title() }}</h1>
          <p class="mb-8 text-sm text-muted">{{ subtitle() }}</p>
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class AuthLayout {
  readonly eyebrow = input('');
  readonly title = input('');
  readonly subtitle = input('');

  protected readonly seats = [1, 2, 3, 4, 5, 6];

  constructor() {
    // Touching the service here guarantees the theme attribute is applied even
    // when someone deep-links straight to /entrar without loading the shell.
    inject(ThemeService);
  }
}
