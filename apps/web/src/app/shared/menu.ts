import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * A dropdown built on the native Popover API: top layer (never clipped by an
 * overflow:hidden parent), light-dismiss on outside click and Esc, and focus
 * handling from the browser — no overlay library.
 *
 * Desktop: anchored to the trigger, flipping above it when there's no room
 * below. Phone: the same element becomes a bottom sheet (pure CSS), where a
 * thumb can actually reach the options.
 *
 * Items are plain `<button class="menu-item">` / `<a class="menu-item">`
 * projected by the parent; clicking one closes the menu.
 */
@Component({
  selector: 'lt-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      [class]="triggerClass()"
      [attr.popovertarget]="id"
      [attr.aria-label]="label() || null"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
    >
      <ng-content select="[trigger]" />
    </button>
    <div #pop [id]="id" popover class="menu" role="menu" (toggle)="onToggle($event)" (click)="onClick($event)">
      @if (heading()) {
        <p class="menu-heading">{{ heading() }}</p>
      }
      <ng-content />
    </div>
  `,
  host: { class: 'inline-flex' },
})
export class Menu {
  readonly triggerClass = input('btn btn-ghost btn-sm');
  readonly label = input('');
  readonly heading = input('');
  /** Which edge of the trigger the menu lines up with on desktop. */
  readonly align = input<'start' | 'end'>('end');

  protected readonly id = `lt-menu-${nextId++}`;
  protected readonly open = signal(false);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly pop = viewChild.required<ElementRef<HTMLElement>>('pop');

  protected onToggle(event: Event): void {
    const opening = (event as ToggleEvent).newState === 'open';
    this.open.set(opening);
    if (opening) this.place();
  }

  /** Any item closes the menu; clicks on padding/headings don't. */
  protected onClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.menu-item')) this.close();
  }

  close(): void {
    try {
      this.pop().nativeElement.hidePopover();
    } catch {
      /* already closed */
    }
  }

  private place(): void {
    const pop = this.pop().nativeElement;
    // Phone: CSS turns it into a bottom sheet; clear any desktop placement.
    if (matchMedia('(max-width: 639px)').matches) {
      pop.style.top = pop.style.left = '';
      return;
    }
    const anchor = this.trigger().nativeElement.getBoundingClientRect();
    const box = pop.getBoundingClientRect();
    const gap = 6;
    const below = anchor.bottom + gap;
    const fitsBelow = below + box.height <= window.innerHeight - 8;
    const top = fitsBelow ? below : Math.max(8, anchor.top - gap - box.height);
    let left = this.align() === 'end' ? anchor.right - box.width : anchor.left;
    left = Math.min(Math.max(8, left), window.innerWidth - box.width - 8);
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    pop.style.transformOrigin = `${this.align() === 'end' ? 'right' : 'left'} ${fitsBelow ? 'top' : 'bottom'}`;
  }
}
