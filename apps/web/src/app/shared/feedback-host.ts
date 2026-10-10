import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { FeedbackService } from '../core/feedback.service';
import { Icon } from './icon';

/** Renders the toasts and the confirm dialog. Mounted once, in the root. */
@Component({
  selector: 'lt-feedback-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of feedback.toasts(); track t.id) {
        <div class="toast" [class.toast-success]="t.tone === 'success'" [class.toast-danger]="t.tone === 'danger'">
          @if (t.tone === 'success') {
            <lt-icon name="check" [size]="17" />
          }
          <span class="min-w-0 flex-1">{{ t.message }}</span>
          <button type="button" class="toast-close" (click)="feedback.dismiss(t.id)" aria-label="Dispensar">
            <lt-icon name="close" [size]="15" />
          </button>
        </div>
      }
    </div>

    <dialog #dlg class="sheet sheet-compact" (cancel)="onCancel($event)" (click)="onBackdrop($event)" aria-labelledby="confirm-title">
      @if (feedback.confirmation(); as c) {
        <div class="sheet-body">
          <h2 id="confirm-title" class="text-xl">{{ c.title }}</h2>
          @if (c.message) {
            <p class="mt-2 text-sm text-ink-2">{{ c.message }}</p>
          }
          <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="btn btn-ghost" (click)="feedback.answer(false)">{{ c.cancelLabel ?? 'Cancelar' }}</button>
            <button
              type="button"
              class="btn"
              [class.btn-danger]="c.tone === 'danger'"
              [class.btn-primary]="c.tone !== 'danger'"
              (click)="feedback.answer(true)"
            >
              {{ c.confirmLabel ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
})
export class FeedbackHost {
  protected readonly feedback = inject(FeedbackService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.feedback.confirmation() && !el.open) el.showModal();
      else if (!this.feedback.confirmation() && el.open) el.close();
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.feedback.answer(false);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dlg().nativeElement) this.feedback.answer(false);
  }
}
