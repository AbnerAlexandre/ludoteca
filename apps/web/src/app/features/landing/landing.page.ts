import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { ThemeService } from '../../core/theme.service';
import { Icon, type IconName } from '../../shared/icon';
import { FEATURED_GAMES, coverUrl, featuredById, thumbUrl, type FeaturedGame } from './featured-games';

interface ShelfBox {
  id: number;
  /** Width as a share of the shelf (container query units). */
  w: number;
  tilt: number;
}

/**
 * Public landing.
 *
 * Built from the product's own material, not from stock landing-page parts:
 * the hero is a shelf of real game boxes (the logo, made literal), the
 * carousel is the catalogue, and each "how it works" step shows the actual
 * screen element it describes — a list tile, a group-shelf row with player
 * tokens, a loan row — instead of an icon in a tinted square.
 *
 * Everything above the fold animates with CSS only (it paints before Angular
 * is busy); the sections further down reveal on scroll with scroll-driven
 * animations where the browser supports them, and simply appear where it
 * doesn't.
 */
@Component({
  selector: 'lt-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <header class="container-wide flex h-16 items-center gap-2 sm:h-20">
      <a routerLink="/" class="mr-auto" aria-label="Ludoteca">
        <img src="/bdsmlogo.png" alt="" class="h-10 w-auto" />
      </a>
      <a routerLink="/" fragment="como-funciona" class="btn btn-quiet btn-sm hidden md:inline-flex">Como funciona</a>
      <button type="button" class="btn btn-quiet btn-icon" (click)="theme.toggle()" aria-label="Alternar tema">
        <lt-icon [name]="themeIcon()" [size]="19" />
      </button>
      @if (isAuthed()) {
        <a routerLink="/colecao" class="btn btn-ink btn-sm">Minhas listas <lt-icon name="arrow-right" [size]="15" /></a>
      } @else {
        <a routerLink="/entrar" class="btn btn-quiet btn-sm">Entrar</a>
        <a routerLink="/criar-conta" class="btn btn-ink btn-sm hidden sm:inline-flex">Criar conta</a>
      }
    </header>

    <main id="conteudo">
      <!-- ============================ HERO ============================ -->
      <section class="container-wide grid items-end gap-12 pt-8 pb-16 sm:pt-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16 lg:pt-20 lg:pb-24">
        <div>
          <p class="eyebrow rise">Coleção · Listas · Grupos · Empréstimos</p>
          <h1 class="display rise mt-5 text-[3rem] leading-[0.92] sm:text-[4.4rem] xl:text-[5.2rem]" style="--i: 1">
            Sua estante de jogos,
            <span class="text-brand-text">à mesa com a turma.</span>
          </h1>
          <p class="rise mt-6 max-w-[34rem] text-[1.06rem] leading-relaxed text-ink-2" style="--i: 2">
            Catalogue seus jogos de tabuleiro e cartas, monte listas, empreste sem esquecer para quem
            — e veja, de relance, quem do grupo tem cada jogo.
          </p>
          <div class="rise mt-8 flex flex-wrap items-center gap-3" style="--i: 3">
            @if (isAuthed()) {
              <a routerLink="/colecao" class="btn btn-primary btn-lg">Abrir minhas listas</a>
              <a routerLink="/buscar" class="btn btn-ghost btn-lg">Buscar um jogo</a>
            } @else {
              <a routerLink="/criar-conta" class="btn btn-primary btn-lg">Começar de graça</a>
              <a routerLink="/entrar" class="btn btn-ghost btn-lg">Já tenho conta</a>
            }
          </div>
          <p class="meta rise mt-6" style="--i: 4">Grátis · Catálogo da Ludopedia · Celular e computador</p>
        </div>

        <!-- The logo, made literal: real boxes standing on a shelf. -->
        <div class="shelf" aria-label="Alguns jogos do catálogo">
          <div class="shelf-row">
            @for (box of shelf; track box.id; let i = $index) {
              <a
                [routerLink]="['/jogo', box.id]"
                class="box"
                [style.width]="box.w + 'cqw'"
                [style.--tilt]="box.tilt + 'deg'"
                [style.--i]="i"
                [attr.aria-label]="nameOf(box.id)"
                [title]="nameOf(box.id)"
              >
                <img [src]="cover(box.id)" alt="" loading="eager" decoding="async" draggable="false" />
              </a>
            }
          </div>
          <div class="shelf-board" aria-hidden="true"></div>
        </div>
      </section>

      <!-- ========================= CAROUSEL ========================= -->
      <section class="overflow-hidden border-y border-line py-8" aria-label="Jogos do catálogo">
        @for (row of rows; track $index; let r = $index) {
          <div class="marquee" [class.mt-4]="r === 1">
            <ul class="marquee-track" [class.marquee-reverse]="r === 1" [style.--dur]="r === 0 ? '70s' : '84s'">
              @for (game of row; track $index) {
                <li>
                  <a [routerLink]="['/jogo', game.ludopediaId]" class="marquee-card" [attr.aria-label]="game.name">
                    <img [src]="cover(game.ludopediaId)" alt="" [attr.loading]="r === 0 ? 'eager' : 'lazy'" decoding="async" draggable="false" />
                    <span class="marquee-name">{{ game.name }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }
        <p class="container-wide meta mt-6">Toque num jogo para ver a ficha completa.</p>
      </section>

      <!-- ======================= HOW IT WORKS ======================= -->
      <section id="como-funciona" class="container-wide py-20 sm:py-28">
        <p class="eyebrow reveal">Como funciona</p>
        <h2 class="display reveal mt-4 max-w-2xl text-[2.4rem] sm:text-[3.3rem]">Três coisas que a planilha nunca fez direito.</h2>

        <div class="mt-16 grid gap-20 sm:mt-20 sm:gap-28">
          <!-- 01 · lists -->
          <article class="step">
            <div class="reveal">
              <p class="step-no">01</p>
              <h3 class="mt-3 text-[1.8rem] sm:text-[2.2rem]">Monte suas listas.</h3>
              <p class="mt-3 max-w-md text-ink-2">
                Coleção, desejos e favoritos já vêm prontos. Crie quantas listas quiser, filtre por tipo, ordene, e veja em lista ou em capas.
              </p>
            </div>
            <div class="demo reveal">
              @for (t of demoLists; track t.name) {
                <div class="demo-list">
                  <span class="tile h-12 w-11 text-2xl" [style.background]="t.color" [style.color]="t.ink">{{ t.name[0] }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold text-ink">{{ t.name }}</span>
                    <span class="meta">{{ t.blurb }}</span>
                  </span>
                  <span class="num text-2xl text-ink">{{ t.count }}</span>
                </div>
              }
            </div>
          </article>

          <!-- 02 · groups -->
          <article class="step step-flip">
            <div class="reveal">
              <p class="step-no">02</p>
              <h3 class="mt-3 text-[1.8rem] sm:text-[2.2rem]">Junte a estante da turma.</h3>
              <p class="mt-3 max-w-md text-ink-2">
                Num grupo, as coleções viram uma estante só. Cada pessoa é uma cor — como as peças de um jogo — e cada jogo mostra quem tem.
              </p>
            </div>
            <div class="demo reveal">
              <div class="mb-3 flex items-center gap-2">
                @for (p of people; track p.initials) {
                  <span class="chip pointer-events-none pl-1!">
                    <span class="seat seat-sm" [class]="'seat seat-sm seat-' + p.seat">{{ p.initials }}</span>
                    {{ p.name }}
                  </span>
                }
              </div>
              @for (row of demoShelf; track row.id) {
                <div class="demo-row">
                  <img [src]="thumb(row.id)" alt="" class="h-11 w-11 rounded-[var(--r-sm)] object-cover" loading="lazy" />
                  <span class="min-w-0 flex-1 truncate font-semibold text-ink">{{ nameOf(row.id) }}</span>
                  <span class="seat-stack">
                    @for (s of row.owners; track s) {
                      <span [class]="'seat seat-sm seat-' + people[s].seat">{{ people[s].initials }}</span>
                    }
                  </span>
                </div>
              }
            </div>
          </article>

          <!-- 03 · loans -->
          <article class="step">
            <div class="reveal">
              <p class="step-no">03</p>
              <h3 class="mt-3 text-[1.8rem] sm:text-[2.2rem]">Empreste sem esquecer.</h3>
              <p class="mt-3 max-w-md text-ink-2">
                Anote para quem foi e desde quando. Amigos pedem emprestado pelo app, você aprova, e a coleção mostra quem está com cada caixa.
              </p>
            </div>
            <div class="demo reveal">
              @for (l of demoLoans; track l.id) {
                <div class="demo-row">
                  <img [src]="thumb(l.id)" alt="" class="h-11 w-11 rounded-[var(--r-sm)] object-cover" loading="lazy" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold text-ink">{{ nameOf(l.id) }}</span>
                    <span class="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                      <span class="tag" [class]="'tag ' + l.tag">{{ l.status }}</span>
                      <span [class]="'seat seat-sm seat-' + people[l.who].seat">{{ people[l.who].initials }}</span>
                      <span class="meta">{{ l.when }}</span>
                    </span>
                  </span>
                </div>
              }
            </div>
          </article>
        </div>
      </section>

      <!-- ======================= THE REST ======================= -->
      <section class="border-t border-line">
        <div class="container-wide grid gap-x-12 gap-y-10 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:py-20">
          @for (f of extras; track f.title; let i = $index) {
            <div class="reveal">
              <lt-icon [name]="f.icon" [size]="22" class="text-brand-text" />
              <h3 class="mt-4 text-lg">{{ f.title }}</h3>
              <p class="mt-2 text-sm text-ink-2">{{ f.body }}</p>
            </div>
          }
        </div>
      </section>

      <!-- ======================= CLOSING ======================= -->
      <section class="container-wide pb-16 sm:pb-24">
        <div class="cta reveal">
          <div>
            <h2 class="display text-[2.4rem] text-white sm:text-[3.4rem]">Bota a coleção na estante.</h2>
            <p class="mt-3 max-w-md text-white/80">Leva um minuto. Suas listas, seus grupos e seus empréstimos num lugar só.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            @if (isAuthed()) {
              <a routerLink="/colecao" class="btn btn-lg cta-btn">Abrir minhas listas</a>
            } @else {
              <a routerLink="/criar-conta" class="btn btn-lg cta-btn">Criar conta grátis</a>
              <a routerLink="/entrar" class="btn btn-lg cta-btn-ghost">Entrar</a>
            }
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-line">
      <div class="container-wide flex flex-wrap items-center justify-between gap-3 py-7">
        <img src="/bdsmlogo.png" alt="Ludoteca" class="h-7 w-auto opacity-80" />
        <p class="meta">Dados dos jogos por Ludopedia.</p>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        overflow-x: clip;
      }

      /* ---- estante do hero ---- */
      .shelf {
        container-type: inline-size;
        width: 100%;
        max-width: 46rem;
        justify-self: center;
      }
      .shelf-row {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        gap: 1.6cqw;
        padding: 0 1.5cqw;
      }
      .box {
        position: relative;
        display: block;
        flex-shrink: 0;
        aspect-ratio: 1;
        border-radius: 1.4cqw;
        overflow: hidden;
        background: var(--surface-2);
        box-shadow:
          0 0.9cqw 0 rgb(30 22 48 / 0.28),
          inset 0 0 0 1px rgb(0 0 0 / 0.08);
        transform-origin: bottom center;
        transform: rotate(var(--tilt, 0deg));
        animation: drop 700ms var(--ease-spring) backwards;
        animation-delay: calc(240ms + var(--i) * 90ms);
        transition:
          transform var(--dur-base) var(--ease-out),
          box-shadow var(--dur-base) var(--ease-out);
      }
      .box img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      @media (hover: hover) and (pointer: fine) {
        .box:hover {
          transform: translateY(-1.6cqw) rotate(var(--tilt, 0deg));
          box-shadow:
            0 2.2cqw 0 rgb(30 22 48 / 0.18),
            var(--shadow-2);
          z-index: 2;
        }
      }
      /* a prateleira: as cores da própria logo (#9f86fe com quina #5131d3) */
      .shelf-board {
        height: clamp(10px, 2.6cqw, 16px);
        border-radius: 6px;
        background: #9f86fe;
        box-shadow: 0 clamp(4px, 1.1cqw, 7px) 0 #5131d3;
        animation: fade-in 500ms ease backwards;
      }
      @keyframes drop {
        from {
          opacity: 0;
          transform: translateY(-14cqw) rotate(var(--tilt, 0deg));
        }
      }

      /* ---- carrossel ---- */
      .marquee {
        overflow: hidden;
      }
      .marquee-track {
        display: flex;
        gap: 0.9rem;
        width: max-content;
        padding: 0.35rem 0.45rem 0.6rem;
        margin: 0;
        list-style: none;
        /* a lista vem dobrada, então -50% é uma volta completa */
        animation: marquee var(--dur, 70s) linear infinite;
        will-change: transform;
      }
      .marquee-reverse {
        animation-direction: reverse;
      }
      .marquee:hover .marquee-track {
        animation-play-state: paused;
      }
      .marquee-card {
        position: relative;
        display: block;
        width: 8rem;
        border-radius: var(--r);
        overflow: hidden;
        background: var(--surface-2);
        box-shadow:
          var(--box-edge),
          inset 0 0 0 1px rgb(0 0 0 / 0.06);
        transition: transform var(--dur-base) var(--ease-out);
      }
      @media (min-width: 640px) {
        .marquee-card {
          width: 9.5rem;
        }
      }
      .marquee-card img {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
      }
      /* nome numa etiqueta sólida que sobe — sem degradê por cima da capa */
      .marquee-name {
        position: absolute;
        left: 0.4rem;
        right: 0.4rem;
        bottom: 0.4rem;
        padding: 0.3rem 0.45rem;
        border-radius: var(--r-xs);
        background: var(--ink);
        color: var(--paper);
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0;
        transform: translateY(6px);
        transition:
          opacity var(--dur-fast) ease,
          transform var(--dur-base) var(--ease-out);
      }
      .marquee-card:hover,
      .marquee-card:focus-visible {
        transform: translateY(-5px) rotate(-1.5deg);
      }
      .marquee-card:hover .marquee-name,
      .marquee-card:focus-visible .marquee-name {
        opacity: 1;
        transform: none;
      }

      /* ---- como funciona ---- */
      .step {
        display: grid;
        gap: 2rem;
        align-items: center;
      }
      @media (min-width: 900px) {
        .step {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
          gap: 5rem;
        }
        .step-flip > :first-child {
          order: 2;
        }
      }
      .step-no {
        font-family: var(--font-mono);
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: var(--brand-text);
      }
      .demo {
        padding: 1.1rem;
        border-radius: var(--r-xl);
        background: var(--surface-2);
        border: 1px solid var(--line);
      }
      .demo-list,
      .demo-row {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.7rem 0.8rem;
        border-radius: var(--r);
        background: var(--surface);
        box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
      }
      .demo-list + .demo-list,
      .demo-row + .demo-row {
        margin-top: 0.5rem;
      }

      /* ---- fechamento ---- */
      .cta {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 2rem;
        padding: 2.5rem 1.75rem;
        border-radius: var(--r-xl);
        background: var(--brand);
        box-shadow: inset 0 -6px 0 rgb(0 0 0 / 0.18);
      }
      @media (min-width: 640px) {
        .cta {
          padding: 3.5rem 3rem;
        }
      }
      .cta-btn {
        background: #fff;
        color: #18161d;
      }
      .cta-btn:hover {
        background: #f1eefe;
      }
      .cta-btn-ghost {
        background: transparent;
        color: #fff;
        border-color: rgb(255 255 255 / 0.4);
      }
      .cta-btn-ghost:hover {
        border-color: #fff;
      }

      /* ---- revelação no scroll (só onde o navegador suporta) ---- */
      @supports (animation-timeline: view()) {
        .reveal {
          animation: rise linear backwards;
          animation-timeline: view();
          animation-range: entry 5% entry 45%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .marquee-track {
          animation: none;
        }
        .marquee {
          overflow-x: auto;
        }
        .reveal {
          animation: none !important;
        }
      }
    `,
  ],
})
export class LandingPage {
  protected readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthStore);

  protected readonly isAuthed = this.auth.isAuthenticated;

  protected readonly themeIcon = computed<IconName>(
    () => (({ light: 'sun', dark: 'moon', system: 'monitor' }) as const)[this.theme.choice()],
  );

  /** Widths sum (with gaps) to the shelf's inline size; one box leans. */
  protected readonly shelf: ShelfBox[] = [
    { id: 20418, w: 20, tilt: 0 }, // Wingspan
    { id: 14981, w: 16, tilt: 0 }, // Azul
    { id: 397, w: 22, tilt: -7 }, // Catan, apoiado no vizinho
    { id: 25894, w: 15, tilt: 0 }, // Cascadia
    { id: 16788, w: 17, tilt: 0 }, // Everdell
  ];

  /** Two rows, each doubled so translateX(-50%) loops seamlessly. */
  protected readonly rows: FeaturedGame[][] = (() => {
    const half = Math.ceil(FEATURED_GAMES.length / 2);
    const top = FEATURED_GAMES.slice(0, half);
    const bottom = FEATURED_GAMES.slice(half);
    return [
      [...top, ...top],
      [...bottom, ...bottom],
    ];
  })();

  protected readonly people = [
    { name: 'Ana', initials: 'AN', seat: 1 },
    { name: 'Bruno', initials: 'BR', seat: 4 },
    { name: 'Carla', initials: 'CA', seat: 3 },
    { name: 'Você', initials: 'VC', seat: 2 },
  ];

  protected readonly demoLists = [
    { name: 'Coleção', blurb: 'O que está na estante', count: 42, color: 'var(--brand)', ink: '#fff' },
    { name: 'Desejos', blurb: 'O que você quer comprar', count: 7, color: 'var(--amber)', ink: '#2a1b00' },
    { name: 'Favoritos', blurb: 'Os que sempre vão junto', count: 5, color: 'var(--rose)', ink: '#fff' },
  ];

  protected readonly demoShelf = [
    { id: 397, owners: [0, 1, 3] }, // Catan
    { id: 14981, owners: [2] }, // Azul
    { id: 20418, owners: [0, 3] }, // Wingspan
  ];

  protected readonly demoLoans = [
    { id: 2, status: 'Emprestado', tag: 'tag-amber', who: 1, when: 'com Bruno há 12 dias' }, // Ticket to Ride
    { id: 606, status: 'Aguardando', tag: 'tag-brand', who: 2, when: 'Carla pediu hoje' }, // Dixit
  ];

  protected readonly extras: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: 'search', title: 'Catálogo da Ludopedia', body: 'Milhares de jogos com capa, número de jogadores, duração e mecânicas.' },
    { icon: 'lock', title: 'Privacidade por jogo', body: 'Público, só amigos ou só você — escolha um padrão e ajuste jogo a jogo.' },
    { icon: 'copy', title: 'Lista pro WhatsApp', body: 'Copie só os nomes de uma lista e cole no grupo. Ou baixe em CSV e JSON.' },
    { icon: 'monitor', title: 'Celular e computador', body: 'Feito para o polegar no celular e para a tela larga no computador.' },
  ];

  protected cover(id: number): string {
    return coverUrl(id);
  }

  protected thumb(id: number): string {
    return thumbUrl(id);
  }

  protected nameOf(id: number): string {
    return featuredById(id)?.name ?? '';
  }
}
