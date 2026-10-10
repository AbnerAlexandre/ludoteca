import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from './icon';

/**
 * A modal built on the native <dialog>: focus trap, Esc, inert background and
 * top layer all come from the browser. Centred card on desktop, bottom sheet
 * on a phone — where forms that used to unfold inline and shove the page down
 * (new group, lend a game) now sit within thumb reach.
 *
 * Controlled by `open`; emits `closed` for every way out (Esc, backdrop tap,
 * the ✕), so the parent's signal stays the single source of truth.
 */
@Component({
  selector: 'lt-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <dialog #dlg class="sheet" [attr.aria-labelledby]="titleId" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      <div class="sheet-body">
        <header class="mb-5 flex items-start justify-between gap-4">
          <div>
            @if (eyebrow()) {
              <p class="eyebrow mb-1.5">{{ eyebrow() }}</p>
            }
            <h2 [id]="titleId" class="text-2xl">{{ heading() }}</h2>
          </div>
          <button type="button" class="btn btn-quiet btn-sm btn-icon -mr-2 -mt-1" (click)="closed.emit()" aria-label="Fechar">
            <lt-icon name="close" [size]="18" />
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Sheet {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly eyebrow = input('');
  readonly closed = output<void>();

  protected readonly titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open() && !el.open) el.showModal();
      else if (!this.open() && el.open) el.close();
    });
  }

  protected onCancel(event: Event): void {
    // Let the parent close it, so `open` and the DOM never disagree.
    event.preventDefault();
    this.closed.emit();
  }

  /** A click whose target is the <dialog> itself landed on the backdrop. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dlg().nativeElement) this.closed.emit();
  }
}
