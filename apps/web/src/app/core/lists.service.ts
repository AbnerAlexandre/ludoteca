import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AddListItemInput,
  BulkActionInput,
  BulkActionResult,
  ExportFormat,
  List,
  ListItem,
  ListItemsQuery,
  Page,
  Privacy,
} from '@ludoteca/shared';
import { API_BASE, ApiService } from './api.service';

/** `names` is plain text, so it downloads as .txt rather than .names. */
const EXTENSION: Record<ExportFormat, string> = { csv: 'csv', json: 'json', names: 'txt' };

@Injectable({ providedIn: 'root' })
export class ListsService {
  private readonly api = inject(ApiService);

  lists(): Promise<List[]> {
    return firstValueFrom(this.api.get<List[]>('/lists'));
  }

  create(name: string): Promise<List> {
    return firstValueFrom(this.api.post<List>('/lists', { name }));
  }

  rename(listId: string, name: string): Promise<List> {
    return firstValueFrom(this.api.patch<List>(`/lists/${listId}`, { name }));
  }

  remove(listId: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/lists/${listId}`));
  }

  items(listId: string, query: Partial<ListItemsQuery>): Promise<Page<ListItem>> {
    return firstValueFrom(this.api.get<Page<ListItem>>(`/lists/${listId}/items`, query as never));
  }

  addItem(listId: string, input: AddListItemInput): Promise<ListItem> {
    return firstValueFrom(this.api.post<ListItem>(`/lists/${listId}/items`, input));
  }

  setPrivacy(listId: string, itemId: string, privacy: Privacy): Promise<ListItem> {
    return firstValueFrom(this.api.patch<ListItem>(`/lists/${listId}/items/${itemId}`, { privacy }));
  }

  removeItem(listId: string, itemId: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/lists/${listId}/items/${itemId}`));
  }

  bulk(listId: string, input: BulkActionInput): Promise<BulkActionResult> {
    return firstValueFrom(this.api.post<BulkActionResult>(`/lists/${listId}/items/bulk`, input));
  }

  /**
   * Streams a list over SSE so rows appear as they arrive instead of the screen
   * blocking on the whole set (spec §5.3).
   *
   * Plain fetch + a reader rather than EventSource: EventSource can't be given
   * headers or credentials the way we need, and it auto-reconnects forever on
   * error, which would hammer the API from a background tab.
   */
  async streamItems(
    listId: string,
    query: Partial<ListItemsQuery>,
    handlers: {
      onMeta?: (meta: { total: number }) => void;
      onItems: (items: ListItem[]) => void;
      onDone?: () => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }

    const response = await fetch(`${API_BASE}/lists/${listId}/items/stream?${params}`, {
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
      ...(signal ? { signal } : {}),
    });

    if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`);

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    // Events can be split across chunks, so hold the tail until it's complete.
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;

        // SSE frames are separated by a blank line.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (!event || !data) continue;

          if (event === 'meta') handlers.onMeta?.(JSON.parse(data));
          else if (event === 'items') handlers.onItems(JSON.parse(data));
          else if (event === 'done') handlers.onDone?.();
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  /**
   * Triggers a browser download without ever putting the data in a URL.
   *
   * Omit `itemIds` to export the whole list; pass them to export a selection.
   * The server sets the real filename in Content-Disposition — this local one
   * is only the fallback the browser uses if it ignores that header.
   */
  async export(listId: string, format: ExportFormat, itemIds?: string[]): Promise<void> {
    const blob = await firstValueFrom(
      this.api.getBlob(`/lists/${listId}/export`, {
        format,
        ...(itemIds?.length ? { itemIds: itemIds.join(',') } : {}),
      }),
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ludoteca.${EXTENSION[format]}`;
    anchor.click();
    // Revoke or the blob leaks for the lifetime of the document.
    URL.revokeObjectURL(url);
  }

  /**
   * The names-only list as a string, for copying rather than downloading —
   * pasting into a chat is the whole point, and a .txt download is a detour.
   */
  async namesText(listId: string, itemIds?: string[]): Promise<string> {
    const blob = await firstValueFrom(
      this.api.getBlob(`/lists/${listId}/export`, {
        format: 'names',
        ...(itemIds?.length ? { itemIds: itemIds.join(',') } : {}),
      }),
    );
    return blob.text();
  }
}
