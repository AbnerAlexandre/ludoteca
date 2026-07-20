import { Injectable } from '@angular/core';

/**
 * In-memory snapshots of a screen's transient state, so returning to it via the
 * browser's Back button (or a "Voltar" control) lands you where you left off —
 * same query, filters, page and scroll — instead of a fresh, empty screen.
 *
 * Why a service and not the router's state: Angular destroys a routed component
 * on navigation, and `scrollPositionRestoration` alone can't restore a list that
 * re-fetches asynchronously — the scroll fires before the rows exist. Keeping the
 * already-loaded rows here lets the page rehydrate synchronously, so the scroll
 * target is real by the time we jump to it.
 *
 * Scope is deliberately a session in memory: a full reload starts clean, and
 * each screen restores only when the incoming navigation was a `popstate` (Back),
 * never on a fresh visit. Callers own that decision (see the pages' `restore`).
 */
@Injectable({ providedIn: 'root' })
export class PageStateService {
  private readonly store = new Map<string, unknown>();

  save(key: string, state: unknown): void {
    this.store.set(key, state);
  }

  take<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  clear(key: string): void {
    this.store.delete(key);
  }
}
