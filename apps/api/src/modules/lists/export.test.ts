import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ListItem } from '@ludoteca/shared';
import { exportFilename, toCsv, toNamesExport } from './export.js';

function item(overrides: { name?: string; note?: string | null } = {}): ListItem {
  return {
    publicId: 'aaaaaaaaaaaa',
    privacy: 'public',
    note: overrides.note ?? null,
    addedAt: '2026-07-17T00:00:00.000Z',
    loan: null,
    game: {
      publicId: 'bbbbbbbbbbbb',
      ludopediaId: 404,
      name: overrides.name ?? 'Terra Mystica',
      originalName: null,
      type: 'board',
      thumbnail: null,
      coverUrl: null,
      link: null,
      year: 2012,
      minPlayers: 2,
      maxPlayers: 5,
      playTimeMinutes: 100,
      minAge: 12,
      detailed: true,
    },
  };
}

test('toCsv writes a header and one row per item', () => {
  const csv = toCsv([item()]);
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0]?.startsWith('name,original_name,type'));
  assert.ok(lines[1]?.startsWith('Terra Mystica,,board,2012'));
});

test('toCsv quotes cells containing commas, quotes or newlines', () => {
  const csv = toCsv([item({ name: 'Catan, Big Box', note: 'He said "great"' })]);
  assert.ok(csv.includes('"Catan, Big Box"'));
  assert.ok(csv.includes('"He said ""great"""'));
});

/**
 * Formula injection: a cell starting with =, +, - or @ is executed by Excel and
 * Google Sheets when the export is opened. Game names come from user input and
 * from Ludopedia, so neither is trusted.
 */
test('toCsv neutralizes formula injection in a game name', () => {
  const csv = toCsv([item({ name: '=cmd|\'/c calc\'!A1' })]);
  assert.ok(!/(^|,)=cmd/.test(csv), 'formula must not start a cell bare');
  assert.ok(csv.includes("\"'=cmd"), `expected quote-prefixed cell, got: ${csv}`);
});

test('toCsv neutralizes every dangerous leading character', () => {
  for (const prefix of ['=', '+', '-', '@']) {
    const csv = toCsv([item({ name: `${prefix}HYPERLINK("http://evil")` })]);
    const dataLine = csv.replace(/^﻿/, '').trim().split('\r\n')[1] ?? '';
    assert.ok(dataLine.startsWith("'") || dataLine.startsWith('"\''), `${prefix} was not neutralized: ${dataLine}`);
  }
});

test('toCsv leaves an ordinary name untouched', () => {
  const csv = toCsv([item({ name: 'Azul' })]);
  assert.ok(csv.includes('\r\nAzul,'));
  assert.ok(!csv.includes("'Azul"));
});

test('toCsv starts with a BOM so Excel reads UTF-8 accents correctly', () => {
  assert.ok(toCsv([item({ name: 'Coleção' })]).startsWith('﻿'));
});

test('exportFilename strips characters that could break the header', () => {
  assert.equal(exportFilename('Meus Jogos', 'csv').replace(/-\d{4}-\d{2}-\d{2}/, ''), 'Meus-Jogos.csv');
  // A quote or CRLF here would let a list name inject response headers.
  const nasty = exportFilename('a"; drop\r\nX-Evil: 1', 'json');
  assert.ok(!/["\r\n;]/.test(nasty), `filename still unsafe: ${nasty}`);
});

test('exportFilename falls back when the name has nothing usable', () => {
  assert.ok(exportFilename('🎲🎲🎲', 'csv').startsWith('ludoteca-'));
});

test('toNamesExport writes one title per line and nothing else', () => {
  const text = toNamesExport([item({ name: 'Azul' }), item({ name: 'Terra Mystica' })]);
  assert.equal(text, 'Azul\r\nTerra Mystica\r\n');
});

test('toNamesExport leaves titles verbatim — it is chat text, not a spreadsheet', () => {
  // No formula escaping and no quoting here: a leading apostrophe or wrapping
  // quotes would be noise in a pasted message. Nothing executes plain text.
  const text = toNamesExport([item({ name: '=Catan, Big Box' })]);
  assert.equal(text, '=Catan, Big Box\r\n');
});

test('toNamesExport returns empty for an empty list', () => {
  assert.equal(toNamesExport([]), '');
});
