import type { ListItem } from '@ludoteca/shared';

const COLUMNS = [
  'name',
  'original_name',
  'type',
  'year',
  'min_players',
  'max_players',
  'play_time_minutes',
  'privacy',
  'note',
  'added_at',
  'ludopedia_id',
  'ludopedia_link',
] as const;

/**
 * CSV escaping, with one non-obvious rule.
 *
 * Beyond the usual quote-doubling, a cell whose text begins with =, +, -, @ or
 * a control char is prefixed with a single quote. Excel and Sheets treat such
 * a cell as a *formula*, so a game named `=cmd|'/c calc'!A1` becomes code
 * execution on the machine of whoever opens the export. The data is
 * user-controlled (and partly Ludopedia-controlled), so it gets neutralized.
 * This is CSV injection / formula injection.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);

  // Neutralized cells are always quoted as well as prefixed. The prefix is what
  // defuses the formula; the quotes keep the apostrophe bound to the cell so a
  // spreadsheet can't re-interpret it while splitting the row.
  let neutralized = false;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
    neutralized = true;
  }

  if (neutralized || /[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(items: ListItem[]): string {
  const rows = [COLUMNS.join(',')];
  for (const item of items) {
    rows.push(
      [
        item.game.name,
        item.game.originalName,
        item.game.type,
        item.game.year,
        item.game.minPlayers,
        item.game.maxPlayers,
        item.game.playTimeMinutes,
        item.privacy,
        item.note,
        item.addedAt,
        item.game.ludopediaId,
        item.game.link,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // CRLF per RFC 4180, and a BOM so Excel reads the accents in Portuguese
  // titles as UTF-8 instead of mojibake.
  return `﻿${rows.join('\r\n')}\r\n`;
}

export function toJsonExport(items: ListItem[], listName: string): string {
  return JSON.stringify(
    {
      list: listName,
      exportedAt: new Date().toISOString(),
      count: items.length,
      items: items.map((item) => ({
        name: item.game.name,
        originalName: item.game.originalName,
        type: item.game.type,
        year: item.game.year,
        minPlayers: item.game.minPlayers,
        maxPlayers: item.game.maxPlayers,
        playTimeMinutes: item.game.playTimeMinutes,
        privacy: item.privacy,
        note: item.note,
        addedAt: item.addedAt,
        ludopediaId: item.game.ludopediaId,
        ludopediaLink: item.game.link,
      })),
    },
    null,
    2,
  );
}

/**
 * Content-Disposition filename. Anything that isn't a safe character is
 * dropped: a quote or a newline in a user-chosen list name would otherwise
 * break out of the header and let the client control the response headers.
 */
export function exportFilename(listName: string, extension: 'csv' | 'json'): string {
  const safe = listName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${safe || 'ludoteca'}-${stamp}.${extension}`;
}
