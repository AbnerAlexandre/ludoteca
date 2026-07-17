import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  // Navigation
  | 'dice'
  | 'search'
  | 'group'
  | 'friends'
  | 'loan'
  // Theme
  | 'sun'
  | 'moon'
  | 'monitor'
  // List kinds
  | 'star'
  | 'heart'
  | 'list'
  // View modes
  | 'view-list'
  | 'view-cards'
  // Actions
  | 'plus'
  | 'close'
  | 'trash'
  | 'download'
  | 'check'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'external-link'
  | 'cart'
  | 'users'
  | 'clock'
  | 'calendar';

/**
 * Inline SVG icon set.
 *
 * Everything is stroked with `currentColor` on a 24×24 grid, so an icon takes
 * its colour from whatever it sits in — `class="text-muted"`, a themed button,
 * the brand accent — with no per-icon variants and no second copy for dark
 * mode. The optional `color` input overrides that when a specific hue is needed.
 *
 * Inline rather than a sprite or an icon font: no extra request, no FOUT, and
 * the strict CSP has nothing to allow. Written as a @switch rather than
 * [innerHTML] so the template compiler validates the markup and no sanitizer
 * bypass is involved.
 *
 * Icons are decorative by default (`aria-hidden`) — the accessible name belongs
 * on the control that owns them. Pass `label` when an icon is the only content.
 */
@Component({
  selector: 'lt-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      [attr.stroke]="color() ?? 'currentColor'"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label()"
      class="shrink-0"
    >
      @switch (name()) {
        <!-- A die showing five pips: the mark of the app, and of a collection. -->
        @case ('dice') {
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1.1" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="16" cy="8" r="1.1" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="12" cy="12" r="1.1" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="8" cy="16" r="1.1" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="16" cy="16" r="1.1" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
        }
        @case ('search') {
          <circle cx="11" cy="11" r="7" />
          <path d="m16.8 16.8 4.2 4.2" />
        }
        <!-- Three figures: a group is more than a pair. -->
        @case ('group') {
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4" />
          <path d="M17.5 13.5a5.5 5.5 0 0 1 3 4.9" />
        }
        <!-- One figure plus a mark: adding a friend. -->
        @case ('friends') {
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M18 8v6" />
          <path d="M15 11h6" />
        }
        <!-- A box handed over: a game out on loan. -->
        @case ('loan') {
          <path d="M21 8.5v7a1.5 1.5 0 0 1-.8 1.3l-7.5 4a1.5 1.5 0 0 1-1.4 0l-7.5-4a1.5 1.5 0 0 1-.8-1.3v-7" />
          <path d="m2.6 7.7 8.7-4.5a1.5 1.5 0 0 1 1.4 0l8.7 4.5-9.4 4.9z" />
          <path d="M12 12.6V21" />
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
        }
        @case ('moon') {
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        }
        @case ('monitor') {
          <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
          <path d="M8.5 20.5h7M12 16.5v4" />
        }
        @case ('star') {
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8z" />
        }
        @case ('heart') {
          <path d="M12 20.5s-8-4.9-8-10a4.7 4.7 0 0 1 8-3.3 4.7 4.7 0 0 1 8 3.3c0 5.1-8 10-8 10z" />
        }
        @case ('list') {
          <path d="M8.5 6.5H21M8.5 12H21M8.5 17.5H21" />
          <circle cx="4" cy="6.5" r="1.2" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="4" cy="12" r="1.2" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
          <circle cx="4" cy="17.5" r="1.2" [attr.fill]="color() ?? 'currentColor'" stroke="none" />
        }
        <!-- Rows with a leading thumbnail: exactly what the list view renders. -->
        @case ('view-list') {
          <rect x="3" y="4.5" width="5" height="5" rx="1.2" />
          <rect x="3" y="14.5" width="5" height="5" rx="1.2" />
          <path d="M11 6.2h10M11 8.8h6M11 16.2h10M11 18.8h6" />
        }
        <!-- Four tiles: exactly what the card view renders. -->
        @case ('view-cards') {
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14" />
        }
        @case ('close') {
          <path d="M6 6l12 12M18 6 6 18" />
        }
        @case ('trash') {
          <path d="M4 7h16" />
          <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
          <path d="M6.5 7l.8 12.1A2 2 0 0 0 9.3 21h5.4a2 2 0 0 0 2-1.9L17.5 7" />
          <path d="M10.5 11v6M13.5 11v6" />
        }
        @case ('download') {
          <path d="M12 3.5v11" />
          <path d="m7.5 10 4.5 4.5 4.5-4.5" />
          <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
        }
        @case ('check') {
          <path d="m4.5 12.5 5 5 10-11" />
        }
        @case ('arrow-left') {
          <path d="M20 12H4" />
          <path d="m10 6-6 6 6 6" />
        }
        @case ('arrow-up') {
          <path d="M12 20V4" />
          <path d="m6 10 6-6 6 6" />
        }
        @case ('arrow-down') {
          <path d="M12 4v16" />
          <path d="m6 14 6 6 6-6" />
        }
        @case ('external-link') {
          <path d="M14 4h6v6" />
          <path d="m20 4-8.5 8.5" />
          <path d="M18 14.5v4A2.5 2.5 0 0 1 15.5 21h-10A2.5 2.5 0 0 1 3 18.5v-10A2.5 2.5 0 0 1 5.5 6h4" />
        }
        @case ('cart') {
          <circle cx="9.5" cy="20" r="1.4" />
          <circle cx="17.5" cy="20" r="1.4" />
          <path d="M2.5 3.5h2.6l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4" />
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        }
        @case ('calendar') {
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        }
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  /** Overrides `currentColor`. Prefer inheriting via a text-colour class. */
  readonly color = input<string | undefined>(undefined);
  readonly strokeWidth = input(1.75);
  /** Set only when the icon carries meaning no adjacent text provides. */
  readonly label = input<string | undefined>(undefined);
}
