import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsFor, seatFor, type Seat } from '../core/seat';
import { Icon, type IconName } from './icon';

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
    <span [class]="classes()" [title]="label()" [attr.aria-label]="label()" role="img">
      {{ initials() }}
    </span>
  `,
})
export class SeatToken {
  readonly user = input.required<{ publicId: string; login: string; displayName?: string | null }>();
  /** Overrides the hashed colour. Supply from assignSeats() in group contexts. */
  readonly seat = input<Seat | undefined>(undefined);

  protected readonly classes = computed(() => `seat seat-${this.seat() ?? seatFor(this.user().publicId)}`);
  protected readonly initials = computed(() => initialsFor(this.user()));
  protected readonly label = computed(() => this.user().displayName || this.user().login);
}

/** Placeholder while a screen's real content loads. */
@Component({
  selector: 'lt-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="skeleton block" [style.height]="height()" [style.width]="width()"></span>`,
})
export class Skeleton {
  readonly height = input('1rem');
  readonly width = input('100%');
}

/**
 * An empty screen is an invitation to act, so this always takes an action —
 * never just a shrug.
 */
@Component({
  selector: 'lt-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-muted"
        style="background: var(--surface-sunken)"
      >
        <lt-icon [name]="icon()" [size]="26" />
      </div>
      <h3 class="mb-1 text-lg">{{ title() }}</h3>
      <p class="mb-5 max-w-sm text-sm text-muted">{{ message() }}</p>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('dice');
  readonly title = input.required<string>();
  readonly message = input('');
}
