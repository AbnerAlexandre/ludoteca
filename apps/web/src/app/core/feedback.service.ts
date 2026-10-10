import { Injectable, signal } from '@angular/core';

export type ToastTone = 'default' | 'success' | 'danger';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * App-wide feedback: transient toasts and the confirm dialog.
 *
 * Toasts replace the inline success notices that used to render at the top of
 * a screen — invisible when you'd just added the 18th search result from
 * halfway down the page. The confirm dialog replaces window.confirm(), which
 * can't be styled, can't say "Excluir" on its button, and blocks the thread.
 *
 * Both are rendered once by FeedbackHost in the root component.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);
  readonly confirmation = signal<PendingConfirm | null>(null);

  toast(message: string, tone: ToastTone = 'default', ms = 3200): void {
    const id = ++this.seq;
    // Keep at most three on screen; the oldest yields.
    this.toasts.update((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(message: string): void {
    this.toast(message, 'success');
  }

  error(message: string): void {
    this.toast(message, 'danger', 4800);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  confirm(request: ConfirmRequest): Promise<boolean> {
    // A second confirm while one is open answers the first with "no".
    this.confirmation()?.resolve(false);
    return new Promise((resolve) => this.confirmation.set({ ...request, resolve }));
  }

  answer(ok: boolean): void {
    const pending = this.confirmation();
    this.confirmation.set(null);
    pending?.resolve(ok);
  }
}
