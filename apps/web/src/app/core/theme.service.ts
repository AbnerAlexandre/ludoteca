import { Injectable, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ludoteca.theme';

/**
 * Theme resolution. `system` follows the OS and keeps following it, so a user
 * whose phone flips to dark at sunset comes along — an explicit choice wins and
 * stays won.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly _choice = signal<ThemeChoice>(this.readStored());
  readonly choice = this._choice.asReadonly();
  readonly resolved = signal<'light' | 'dark'>('light');

  constructor() {
    this.apply();
    // Only relevant while the choice is `system`; apply() re-checks.
    this.media.addEventListener('change', () => {
      if (this._choice() === 'system') this.apply();
    });
  }

  set(choice: ThemeChoice): void {
    this._choice.set(choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Private mode or blocked storage: the theme just won't persist.
    }
    this.apply();
  }

  /** Cycles light → dark → system, for the single header button. */
  toggle(): void {
    const order: ThemeChoice[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(this._choice()) + 1) % order.length]!;
    this.set(next);
  }

  private apply(): void {
    const resolved = this._choice() === 'system' ? (this.media.matches ? 'dark' : 'light') : this._choice();
    this.resolved.set(resolved as 'light' | 'dark');
    document.documentElement.setAttribute('data-theme', resolved);
  }

  private readStored(): ThemeChoice {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      /* ignore */
    }
    return 'system';
  }
}
