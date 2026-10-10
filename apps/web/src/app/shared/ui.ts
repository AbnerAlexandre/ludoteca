import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { initialsFor, seatFor, type Seat } from '../core/seat';
import { Icon } from './icon';

/**
 * A person, as a coloured token. The signature element: a row of these answers
 * "who owns this?" without reading a name.
 *
 * Pass `seat` where several people are compared side by side (the group shelf):
 * assignSeats() guarantees they're distinct there, which the per-person hash
 * cannot. Omit it elsewhere and the person keeps their usual colour.
 *
 * The colour is never the only carrier of meaning — the initials are inside the
 * token and the full name is in the tooltip and aria-label, so this still works
 * for a colour-blind user, and past six people where colours must repeat.
 */
@Component({
  selector: 'lt-seat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [title]="label()" [attr.aria-label]="label()" role="img">{{ initials() }}</span>
  `,
  host: { class: 'inline-flex' },
})
export class SeatToken {
  readonly user = input.required<{ publicId: string; login: string; displayName?: string | null }>();
  /** Overrides the hashed colour. Supply from assignSeats() in group contexts. */
  readonly seat = input<Seat | undefined>(undefined);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  protected readonly classes = computed(() => {
    const size = this.size() === 'md' ? '' : ` seat-${this.size()}`;
    return `seat seat-${this.seat() ?? seatFor(this.user().publicId)}${size}`;
  });
  protected readonly initials = computed(() => initialsFor(this.user()));
  protected readonly label = computed(() => this.user().displayName || this.user().login);
}

/**
 * A game box. The host IS the frame (size it with classes from the parent:
 * `<lt-cover class="h-14 w-14" …>`), so layout stays in the template that knows
 * the context. The image fades in once decoded instead of popping.
 */
@Component({
  selector: 'lt-cover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (src()) {
      <img
        [src]="src()"
        [alt]="alt()"
        [attr.loading]="eager() ? 'eager' : 'lazy'"
        decoding="async"
        draggable="false"
        [class.is-loaded]="loaded()"
        (load)="loaded.set(true)"
        (error)="loaded.set(true)"
      />
    } @else {
      <span class="cover-empty h-full w-full"><lt-icon name="dice" [size]="iconSize()" /></span>
    }
  `,
  styles: [
    `
      img {
        opacity: 0;
        transition: opacity 320ms var(--ease-out);
      }
      img.is-loaded {
        opacity: 1;
      }
    `,
  ],
  host: { class: 'cover' },
})
export class Cover {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  readonly eager = input(false);
  readonly iconSize = input(20);
  protected readonly loaded = signal(false);
}

/**
 * The top of every screen: a mono eyebrow, the title in the display face, an
 * optional line of context, and actions projected on the right (they drop
 * below on a phone). Left-aligned on purpose — a centred title over a form is
 * the look of a template, not of a tool.
 */
@Component({
  selector: 'lt-page-head',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8">
      <div class="rise min-w-0">
        @if (eyebrow()) {
          <p class="eyebrow mb-2.5">{{ eyebrow() }}</p>
        }
        <h1 class="display text-[2.15rem] sm:text-[2.75rem]">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-2.5 max-w-xl text-[0.95rem] text-ink-2">{{ subtitle() }}</p>
        }
      </div>
      <div class="rise flex flex-wrap items-center gap-2" style="--i: 2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHead {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
}

/** Placeholder while a screen's real content loads. */
@Component({
  selector: 'lt-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="skeleton" [style.height]="height()" [style.width]="width()"></span>`,
})
export class Skeleton {
  readonly height = input('1rem');
  readonly width = input('100%');
}

/**
 * An empty screen is an invitation to act, so it always offers one. The art is
 * the product's own picture — an empty shelf with a single box leaning on it —
 * not an icon dropped in a tinted square.
 */
@Component({
  selector: 'lt-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fade-in flex flex-col items-start gap-4 rounded-[var(--r-lg)] border border-dashed border-line-strong px-6 py-10 sm:flex-row sm:items-center sm:gap-8 sm:px-10">
      <svg width="112" height="72" viewBox="0 0 112 72" fill="none" aria-hidden="true" class="shrink-0 text-ink-3">
        <rect x="8" y="10" width="22" height="50" rx="3" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
        <rect x="38" y="20" width="18" height="40" rx="3" fill="var(--brand-soft)" stroke="var(--brand-text)" stroke-width="2" transform="rotate(-12 47 60)" />
        <rect x="74" y="16" width="22" height="44" rx="3" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" />
        <rect x="2" y="60" width="108" height="8" rx="4" fill="currentColor" opacity="0.35" />
      </svg>
      <div class="min-w-0">
        <h3 class="text-xl">{{ title() }}</h3>
        @if (message()) {
          <p class="mt-1.5 max-w-md text-sm text-ink-2">{{ message() }}</p>
        }
        <div class="mt-4 flex flex-wrap gap-2 empty:hidden"><ng-content /></div>
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input('');
}
