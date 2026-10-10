import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/theme.service';
import { FEATURED_GAMES, coverUrl, thumbUrl } from '../landing/featured-games';

/**
 * Shared frame for login/register.
 *
 * The form sits on the page itself — no card around it, the page already has
 * structure. The other side is the product's own content: a wall of real
 * covers from the catalogue drifting slowly in columns, and over it one row of
 * a group shelf, the thing the app exists to show (who has which game, one
 * colour per person).
 *
 * Phone: the wall collapses to a short fanned strip of covers above the form.
 */
@Component({
  selector: 'lt-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="grid min-h-dvh lg:grid-cols-[minmax(0,34rem)_1fr]">
      <main id="conteudo" class="flex flex-col px-5 pt-5 pb-10 sm:px-10 lg:px-14 lg:pt-8">
        <a routerLink="/" class="inline-flex w-fit" aria-label="Ludoteca, página inicial">
          <img src="/bdsmlogo.png" alt="" class="h-10 w-auto" />
        </a>

        <!-- Phone: a fanned hand of covers instead of the wall. -->
        <div class="fan mt-8 flex justify-center lg:hidden" aria-hidden="true">
          @for (g of fan; track g.ludopediaId; let i = $index) {
            <img [src]="thumb(g.ludopediaId)" alt="" class="fan-card" [style.--i]="i" [style.--n]="fan.length" />
          }
        </div>

        <div class="my-auto w-full max-w-[23rem] pt-10 pb-6 lg:pt-16">
          <p class="eyebrow rise mb-3 text-brand-text!">{{ eyebrow() }}</p>
          <h1 class="display rise text-[2.4rem] sm:text-[2.9rem]" style="--i: 1">{{ title() }}</h1>
          <p class="rise mt-3 mb-9 text-[0.95rem] text-ink-2" style="--i: 2">{{ subtitle() }}</p>
          <div class="rise" style="--i: 3"><ng-content /></div>
        </div>

        <p class="meta mt-auto">Catálogo de jogos por Ludopedia.</p>
      </main>

      <aside class="wall relative hidden overflow-hidden lg:block" aria-hidden="true">
        <div class="wall-grid">
          @for (col of columns; track $index; let c = $index) {
            <div class="wall-col" [class.wall-col-down]="c % 2 === 1" [style.--dur]="70 + c * 12 + 's'">
              @for (g of col; track $index) {
                <img [src]="cover(g.ludopediaId)" alt="" loading="lazy" decoding="async" class="wall-cover" />
              }
            </div>
          }
        </div>

        <!-- One row of a group shelf: the product, not an illustration of it. -->
        <div class="shelf-demo pop-in" style="--i: 6">
          <img [src]="thumb(demo.ludopediaId)" alt="" class="h-14 w-14 rounded-[var(--r-sm)] object-cover" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-ink">{{ demo.name }}</p>
            <p class="meta mt-0.5">{{ demo.minPlayers }}–{{ demo.maxPlayers }}p · {{ demo.playTimeMinutes }}min</p>
          </div>
          <div class="seat-stack">
            <span class="seat seat-sm seat-1">AN</span>
            <span class="seat seat-sm seat-4">BR</span>
            <span class="seat seat-sm seat-2">VC</span>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ---- parede de capas (desktop) ---- */
      .wall {
        background: #141218;
      }
      .wall-grid {
        position: absolute;
        inset: -12% -8%;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1rem;
        transform: rotate(-7deg);
      }
      .wall-col {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        animation: drift-up var(--dur, 80s) linear infinite;
        will-change: transform;
      }
      .wall-col-down {
        animation-direction: reverse;
      }
      .wall-cover {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: var(--r);
        box-shadow: 0 4px 0 rgb(0 0 0 / 0.45);
        opacity: 0.88;
      }

      .shelf-demo {
        position: absolute;
        left: 2.5rem;
        right: 2.5rem;
        bottom: 2.5rem;
        max-width: 26rem;
        display: flex;
        align-items: center;
        gap: 0.9rem;
        padding: 0.75rem 0.9rem;
        border-radius: var(--r-lg);
        background: var(--surface);
        border: 1px solid var(--line);
        box-shadow: var(--shadow-3);
      }

      /* ---- leque de capas (celular) ---- */
      .fan {
        height: 5.5rem;
      }
      .fan-card {
        width: 4.6rem;
        height: 4.6rem;
        margin-inline: -0.7rem;
        object-fit: cover;
        border-radius: var(--r-sm);
        border: 3px solid var(--surface);
        box-shadow: var(--box-edge), var(--shadow-2);
        --mid: calc((var(--n) - 1) / 2);
        transform: rotate(calc((var(--i) - var(--mid)) * 7deg)) translateY(calc(max(var(--i) - var(--mid), var(--mid) - var(--i)) * 6px));
        animation: rise 600ms var(--ease-out) backwards;
        animation-delay: calc(var(--i) * 60ms);
      }

      @media (prefers-reduced-motion: reduce) {
        .wall-col {
          animation: none;
        }
      }
    `,
  ],
})
export class AuthLayout {
  readonly eyebrow = input('');
  readonly title = input('');
  readonly subtitle = input('');

  /** Four columns, each doubled so translateY(-50%) loops seamlessly. */
  protected readonly columns = [0, 1, 2, 3].map((c) => {
    const col = FEATURED_GAMES.filter((_, i) => i % 4 === c);
    return [...col, ...col];
  });
  protected readonly fan = FEATURED_GAMES.slice(0, 5);
  protected readonly demo = FEATURED_GAMES[0]!;

  protected cover(id: number): string {
    return coverUrl(id);
  }

  protected thumb(id: number): string {
    return thumbUrl(id);
  }

  constructor() {
    // Touching the service here guarantees the theme attribute is applied even
    // when someone deep-links straight to /entrar without loading the shell.
    inject(ThemeService);
  }
}
