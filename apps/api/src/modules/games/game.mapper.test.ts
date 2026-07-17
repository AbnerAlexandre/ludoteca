import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromDetail, fromSearchResult, inferGameType } from './game.mapper.js';

// Shapes below are real payloads from https://ludopedia.com.br/api/v1, trimmed.

test('inferGameType maps expansions regardless of category', () => {
  assert.equal(inferGameType('e', []), 'expansion');
  assert.equal(inferGameType('e', ['Jogo de Cartas']), 'expansion');
});

test('inferGameType detects card games from the Ludopedia category taxonomy', () => {
  // Dominion (73) and Hanabi (570) are both tp_jogo 'b' upstream — the only
  // signal that they are card games is the category.
  assert.equal(inferGameType('b', ['Jogo de Cartas']), 'cards');
  assert.equal(inferGameType('b', ['Jogo de Cartas', 'Jogo de Entrada', 'Jogo Festivo']), 'cards');
});

test('inferGameType falls back to board for base games with no card category', () => {
  assert.equal(inferGameType('b', []), 'board');
  assert.equal(inferGameType('b', ['Jogo Assimétrico']), 'board');
  assert.equal(inferGameType('b', ['Destreza']), 'board');
});

test('inferGameType returns other when upstream tells us nothing', () => {
  assert.equal(inferGameType(undefined, []), 'other');
});

test('inferGameType does not mistake "Jogo de Cartório" for a card game', () => {
  // Word-boundary matching, not a naive substring on "cart".
  assert.equal(inferGameType('b', ['Jogo de Cartório']), 'board');
});

test('fromSearchResult makes the relative search link absolute', () => {
  // /jogos returns link relative; /jogos/{id} returns it absolute.
  const mapped = fromSearchResult({
    id_jogo: 397,
    nm_jogo: 'Catan: O Jogo',
    nm_original: 'CATAN (The Settlers of Catan)',
    thumb: 'https://storage.googleapis.com/ludopedia-capas/397_t.jpg',
    link: 'jogo/catan-the-settlers-of-catan',
    ano_publicacao: 1995,
  });
  assert.equal(mapped.link, 'https://ludopedia.com.br/jogo/catan-the-settlers-of-catan');
  assert.equal(mapped.year, 1995);
  assert.equal(mapped.detailed, false);
});

test('fromSearchResult derives the medium cover from the thumb', () => {
  const mapped = fromSearchResult({
    id_jogo: 404,
    thumb: 'https://storage.googleapis.com/ludopedia-capas/404_t.jpg',
  });
  assert.equal(mapped.coverUrl, 'https://storage.googleapis.com/ludopedia-capas/404_m.jpg');
});

test('fromDetail keeps an already-absolute link untouched', () => {
  const mapped = fromDetail({
    id_jogo: 404,
    nm_jogo: 'Terra Mystica',
    tp_jogo: 'b',
    link: 'https://ludopedia.com.br/jogo/terra-mystica',
  });
  assert.equal(mapped.link, 'https://ludopedia.com.br/jogo/terra-mystica');
});

test('fromDetail prefers the Brazilian release year', () => {
  const mapped = fromDetail({
    id_jogo: 404,
    nm_jogo: 'Terra Mystica',
    tp_jogo: 'b',
    ano_publicacao: 2012,
    ano_nacional: 2016,
  });
  assert.equal(mapped.year, 2016);
});

test('fromDetail reads people from nm_profissional', () => {
  const mapped = fromDetail({
    id_jogo: 404,
    nm_jogo: 'Terra Mystica',
    tp_jogo: 'b',
    designers: [{ nm_profissional: 'Jens Drögemüller' }, { nm_profissional: 'Helge Ostertag' }],
    artistas: [{ nm_profissional: 'Dennis Lohausen' }],
  });
  assert.deepEqual(mapped.designers, ['Jens Drögemüller', 'Helge Ostertag']);
  assert.deepEqual(mapped.artists, ['Dennis Lohausen']);
});

test('fromDetail survives a payload with nothing but an id', () => {
  // Upstream is documented ALPHA; a sparse row must not throw.
  const mapped = fromDetail({ id_jogo: 9999 });
  assert.equal(mapped.name, 'Jogo 9999');
  assert.equal(mapped.type, 'other');
  assert.equal(mapped.link, null);
  assert.equal(mapped.thumbnail, null);
  assert.deepEqual(mapped.mechanics, []);
});

test('mappers drop entries with a missing name instead of emitting undefined', () => {
  const mapped = fromDetail({
    id_jogo: 1,
    mecanicas: [{ nm_mecanica: 'Cooperativo' }, {}],
    designers: [{}, { nm_profissional: 'Real Person' }],
  });
  assert.deepEqual(mapped.mechanics, ['Cooperativo']);
  assert.deepEqual(mapped.designers, ['Real Person']);
});
