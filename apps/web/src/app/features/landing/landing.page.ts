import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { ThemeService } from '../../core/theme.service';
import { Icon, type IconName } from '../../shared/icon';
import { FEATURED_GAMES, coverUrl, type FeaturedGame } from './featured-games';

interface Feature {
  icon: IconName;
  color: string;
  title: string;
  body: string;
}

/**
 * Public landing / hero.
 *
 * The game marquee is the centrepiece and it's fed by the hard-coded
 * FEATURED_GAMES, so it paints immediately — no API call stands between the
 * page load and the covers being on screen. The two rows scroll in opposite
 * directions via a pure CSS transform (GPU-composited, cheap), and the whole
 * effect is disabled under prefers-reduced-motion, where the rows become
 * ordinary horizontally-scrollable strips instead.
 */
@Component({
  selector: 'lt-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="landing">
      <!-- Ambient colour wash behind the hero. Decorative, pointer-events off. -->
      <div class="glow glow-a" aria-hidden="true"></div>
      <div class="glow glow-b" aria-hidden="true"></div>

      <header class="relative z-10">
        <div class="container-app flex h-16 items-center gap-3">
          <a routerLink="/" class="flex items-center gap-2.5" aria-label="Ludoteca">
            <span class="grid h-9 w-9 place-items-center rounded-xl" style="background: var(--color-brand-600)" aria-hidden="true">
              <span class="grid grid-cols-2 gap-[3px]">
                @for (p of pips; track $index) {
                  <span class="h-[3px] w-[3px] rounded-full bg-white"></span>
                }
              </span>
            </span>
            <span class="font-display text-lg font-extrabold tracking-tight text-strong">Ludoteca</span>
          </a>
          <div class="flex-1"></div>
          <button type="button" class="btn btn-quiet btn-icon" (click)="theme.toggle()" [attr.aria-label]="'Alternar tema'">
            <lt-icon [name]="themeIcon()" />
          </button>
          @if (isAuthed()) {
            <a routerLink="/colecao" class="btn btn-primary btn-sm">Minhas listas</a>
          } @else {
            <a routerLink="/entrar" class="btn btn-ghost btn-sm hidden sm:inline-flex">Entrar</a>
            <a routerLink="/criar-conta" class="btn btn-primary btn-sm">Criar conta</a>
          }
        </div>
      </header>

      <!-- Hero -->
      <section class="relative z-10">
        <div class="container-app pt-12 pb-10 text-center sm:pt-20 sm:pb-14">
          <p class="reveal mb-4 inline-flex items-center gap-2 rounded-full border border-subtle px-3 py-1 text-xs font-semibold text-muted" style="animation-delay: 40ms">
            <span class="h-1.5 w-1.5 rounded-full" style="background: var(--color-success)"></span>
            Catálogo em parceria com a Ludopedia
          </p>
          <h1 class="reveal mx-auto max-w-3xl text-5xl leading-[0.95] sm:text-7xl" style="animation-delay: 90ms">
            Sua coleção de jogos,<br />
            <span class="grad-text">finalmente organizada.</span>
          </h1>
          <p class="reveal mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg" style="animation-delay: 150ms">
            Catalogue seus jogos de tabuleiro e cartas, monte listas, empreste para amigos e veja,
            de relance, quem tem o quê na sua turma.
          </p>
          <div class="reveal mt-8 flex flex-wrap items-center justify-center gap-3" style="animation-delay: 210ms">
            @if (isAuthed()) {
              <a routerLink="/colecao" class="btn btn-primary btn-lg">Ir para minhas listas</a>
              <a routerLink="/buscar" class="btn btn-ghost btn-lg">Buscar um jogo</a>
            } @else {
              <a routerLink="/criar-conta" class="btn btn-primary btn-lg">Começar de graça</a>
              <a routerLink="/entrar" class="btn btn-ghost btn-lg">Já tenho conta</a>
            }
          </div>
        </div>
      </section>

      <!-- The marquee: two rows, opposite directions, seamless loop. -->
      <section class="relative z-10 py-4" aria-label="Alguns jogos do catálogo">
        <div class="marquee-mask">
          <div class="marquee">
            <ul class="marquee-track" style="--dur: 64s">
              @for (game of rowTop(); track $index) {
                <li>
                  <a
                    [routerLink]="['/jogo', game.ludopediaId]"
                    class="game-card"
                    [attr.aria-label]="game.name"
                    [attr.title]="game.name"
                  >
                    <img [src]="cover(game)" [alt]="game.name" loading="eager" decoding="async" draggable="false" />
                    <span class="game-card-name">{{ game.name }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
          <div class="marquee mt-4">
            <ul class="marquee-track marquee-reverse" style="--dur: 78s">
              @for (game of rowBottom(); track $index) {
                <li>
                  <a
                    [routerLink]="['/jogo', game.ludopediaId]"
                    class="game-card"
                    [attr.aria-label]="game.name"
                    [attr.title]="game.name"
                  >
                    <img [src]="cover(game)" [alt]="game.name" loading="eager" decoding="async" draggable="false" />
                    <span class="game-card-name">{{ game.name }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        </div>
        <p class="container-app mt-5 text-center text-xs text-muted">
          Clique em qualquer jogo para ver a ficha completa.
        </p>
      </section>

      <!-- Features -->
      <section class="relative z-10">
        <div class="container-app py-14 sm:py-20">
          <h2 class="mx-auto mb-10 max-w-2xl text-center text-3xl sm:text-4xl">
            Tudo o que sua ludoteca precisa
          </h2>
          <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (f of features; track f.title; let i = $index) {
              <li class="feature-card reveal" [style.animation-delay.ms]="i * 60">
                <span
                  class="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                  [style.color]="f.color"
                  [style.background]="'color-mix(in srgb, ' + f.color + ' 14%, transparent)'"
                >
                  <lt-icon [name]="f.icon" [size]="22" />
                </span>
                <h3 class="mb-1.5 text-lg">{{ f.title }}</h3>
                <p class="text-sm text-muted">{{ f.body }}</p>
              </li>
            }
          </ul>
        </div>
      </section>

      <!-- Closing CTA -->
      <section class="relative z-10">
        <div class="container-app pb-20">
          <div class="cta-card">
            <h2 class="text-3xl sm:text-4xl">Pronto para organizar a estante?</h2>
            <p class="mt-3 max-w-md text-sm" style="color: var(--color-ink-200)">
              Leva um minuto para criar a conta. Suas listas, seus grupos e seus empréstimos em um só lugar.
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              @if (isAuthed()) {
                <a routerLink="/colecao" class="btn btn-lg cta-btn">Abrir minhas listas</a>
              } @else {
                <a routerLink="/criar-conta" class="btn btn-lg cta-btn">Criar conta grátis</a>
                <a routerLink="/entrar" class="btn btn-lg cta-btn-ghost">Entrar</a>
              }
            </div>
          </div>
        </div>
      </section>

      <footer class="relative z-10 border-t border-subtle">
        <div class="container-app flex flex-wrap items-center justify-between gap-2 py-6 text-xs text-muted">
          <span>Ludoteca — sua coleção de jogos.</span>
          <span>Dados dos jogos por Ludopedia.</span>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--surface-page);
        min-height: 100dvh;
        overflow: hidden;
      }
      .landing {
        position: relative;
      }

      /* Ambient glows behind the hero. */
      .glow {
        position: absolute;
        border-radius: 9999px;
        filter: blur(90px);
        opacity: 0.5;
        pointer-events: none;
        z-index: 0;
      }
      .glow-a {
        top: -8rem;
        left: 50%;
        height: 30rem;
        width: 40rem;
        transform: translateX(-50%);
        background: radial-gradient(closest-side, var(--color-brand-600), transparent);
        opacity: 0.35;
      }
      .glow-b {
        top: 10rem;
        right: -6rem;
        height: 24rem;
        width: 24rem;
        background: radial-gradient(closest-side, var(--color-seat-6), transparent);
        opacity: 0.18;
      }

      .grad-text {
        background: linear-gradient(100deg, var(--color-brand-400), var(--color-seat-1) 55%, var(--color-warning));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .btn-lg {
        min-height: 3rem;
        padding-inline: 1.5rem;
        font-size: 0.95rem;
      }

      /* --- Marquee --------------------------------------------------------- */
      .marquee-mask {
        /* Fade the edges so cards slide in and out rather than pop. */
        -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
        mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
      }
      .marquee {
        overflow: hidden;
      }
      .marquee-track {
        display: flex;
        gap: 1rem;
        width: max-content;
        padding-inline: 0.5rem;
        /* The list is doubled in the component, so -50% is one full loop. */
        animation: marquee var(--dur, 60s) linear infinite;
        will-change: transform;
      }
      .marquee-reverse {
        animation-direction: reverse;
      }
      .marquee:hover .marquee-track {
        animation-play-state: paused;
      }
      @keyframes marquee {
        to {
          transform: translateX(-50%);
        }
      }

      .game-card {
        position: relative;
        display: block;
        width: 8.5rem;
        border-radius: 0.85rem;
        overflow: hidden;
        background: var(--surface-sunken);
        border: 1px solid var(--border-subtle);
        box-shadow: var(--shadow-card);
        transition:
          transform 220ms var(--ease-snap),
          box-shadow 220ms ease,
          border-color 220ms ease;
      }
      @media (min-width: 640px) {
        .game-card {
          width: 10rem;
        }
      }
      .game-card img {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
      }
      .game-card-name {
        position: absolute;
        inset-inline: 0;
        bottom: 0;
        padding: 1.4rem 0.6rem 0.5rem;
        font-size: 0.7rem;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(transparent, rgb(0 0 0 / 0.82));
        opacity: 0;
        transform: translateY(0.3rem);
        transition:
          opacity 200ms ease,
          transform 200ms ease;
      }
      .game-card:hover {
        transform: translateY(-6px) scale(1.03);
        border-color: var(--color-brand-500);
        box-shadow:
          0 12px 30px -10px rgb(0 0 0 / 0.5),
          0 0 0 1px var(--color-brand-500);
        z-index: 2;
      }
      .game-card:hover .game-card-name {
        opacity: 1;
        transform: none;
      }
      .game-card:focus-visible {
        outline: 2px solid var(--color-brand-500);
        outline-offset: 2px;
      }

      /* --- Feature cards --------------------------------------------------- */
      .feature-card {
        background: var(--surface-card);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-card);
        padding: 1.5rem;
        transition:
          transform 200ms var(--ease-snap),
          border-color 200ms ease;
      }
      .feature-card:hover {
        transform: translateY(-3px);
        border-color: var(--border-strong);
      }

      /* --- Closing CTA ----------------------------------------------------- */
      .cta-card {
        position: relative;
        overflow: hidden;
        border-radius: 1.5rem;
        padding: 3rem 2rem;
        background: linear-gradient(135deg, var(--color-brand-700), var(--color-ink-900));
        color: #fff;
      }
      @media (min-width: 640px) {
        .cta-card {
          padding: 4rem 3.5rem;
        }
      }
      .cta-card h2 {
        color: #fff;
      }
      .cta-btn {
        background: #fff;
        color: var(--color-ink-950);
      }
      .cta-btn:hover {
        filter: brightness(0.94);
      }
      .cta-btn-ghost {
        background: rgb(255 255 255 / 0.12);
        color: #fff;
        border-color: rgb(255 255 255 / 0.25);
      }
      .cta-btn-ghost:hover {
        background: rgb(255 255 255 / 0.2);
      }

      /* --- Entrance ------------------------------------------------------- */
      .reveal {
        animation: reveal-up 600ms var(--ease-snap) both;
      }
      @keyframes reveal-up {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .marquee-track {
          animation: none;
          /* Fall back to a normal scrollable strip. */
          transform: none;
        }
        .marquee {
          overflow-x: auto;
        }
        .reveal {
          animation: none;
        }
      }
    `,
  ],
})
export class LandingPage {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthStore);

  protected readonly pips = Array.from({ length: 6 });
  protected readonly isAuthed = this.auth.isAuthenticated;

  protected readonly themeIcon = computed<IconName>(
    () => (({ light: 'sun', dark: 'moon', system: 'monitor' }) as const)[this.theme.choice()],
  );

  /**
   * Split the catalogue into two rows, each doubled so the CSS translateX(-50%)
   * loops seamlessly. Splitting keeps a game from appearing twice in the same
   * row at the same time.
   */
  private readonly half = Math.ceil(FEATURED_GAMES.length / 2);
  private readonly topGames = FEATURED_GAMES.slice(0, this.half);
  private readonly bottomGames = FEATURED_GAMES.slice(this.half);

  protected rowTop(): FeaturedGame[] {
    return [...this.topGames, ...this.topGames];
  }
  protected rowBottom(): FeaturedGame[] {
    return [...this.bottomGames, ...this.bottomGames];
  }

  protected cover(game: FeaturedGame): string {
    return coverUrl(game.ludopediaId);
  }

  protected readonly features: Feature[] = [
    {
      icon: 'dice',
      color: 'var(--color-brand-500)',
      title: 'Suas listas, do seu jeito',
      body: 'Coleção, lista de desejos, favoritos e quantas listas personalizadas você quiser. Card ou grade, com ordenação e busca.',
    },
    {
      icon: 'search',
      color: 'var(--color-seat-6)',
      title: 'Catálogo da Ludopedia',
      body: 'Busque entre milhares de jogos e adicione à sua estante com um clique. Capa, mecânicas, número de jogadores e mais.',
    },
    {
      icon: 'group',
      color: 'var(--color-seat-3)',
      title: 'Grupos que mostram quem tem o quê',
      body: 'Junte a estante da turma num só lugar. Cada pessoa vira uma cor e você vê, de relance, quem possui cada jogo.',
    },
    {
      icon: 'loan',
      color: 'var(--color-seat-5)',
      title: 'Empréstimos sob controle',
      body: 'Emprestou o Catan e esqueceu com quem? Acompanhe o que está emprestado, para quem, e desde quando.',
    },
    {
      icon: 'friends',
      color: 'var(--color-seat-1)',
      title: 'Amigos e privacidade',
      body: 'Adicione amigos e decida por jogo quem vê o quê: público, só amigos ou só você. O padrão é seu.',
    },
    {
      icon: 'download',
      color: 'var(--color-success)',
      title: 'Leve sua coleção com você',
      body: 'Exporte suas listas em CSV, JSON ou só os nomes — perfeito para mandar no grupo do WhatsApp.',
    },
  ];
}
