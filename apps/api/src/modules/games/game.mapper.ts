import type { Game, GameDetail, GameType } from '@ludoteca/shared';
import type { GameRow } from '../../db/schema.js';
import type { LudopediaJogo, LudopediaJogoResumo } from './ludopedia.client.js';

const LUDOPEDIA_ORIGIN = 'https://ludopedia.com.br';

/**
 * `link` comes back relative from /jogos and absolute from /jogos/{id}. Our DTO
 * promises a URL, so normalize here — otherwise the response serializer
 * rejects half the search results.
 */
function absoluteLink(link: string | undefined): string | null {
  if (!link) return null;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  return `${LUDOPEDIA_ORIGIN}/${link.replace(/^\/+/, '')}`;
}

/**
 * Covers follow a suffix convention on their CDN: `404_t.jpg` is the 150px
 * thumb and `404_m.jpg` the medium art. Derive the cover from the thumb rather
 * than making a second upstream call for it.
 */
function coverFromThumb(thumb: string | undefined): string | null {
  if (!thumb) return null;
  return thumb.replace(/_t\.jpg$/i, '_m.jpg');
}

/**
 * Ludopedia's `tp_jogo` only distinguishes base games from expansions, but the
 * spec wants `cards` as a first-class type for filtering and sorting. Their
 * category taxonomy carries it: card games are tagged "Jogo de Cartas".
 *
 * Expansion wins over category — an expansion to a card game is still shelved
 * as an expansion.
 */
export function inferGameType(
  tpJogo: 'b' | 'e' | undefined,
  categories: readonly string[],
): GameType {
  if (tpJogo === 'e') return 'expansion';

  const haystack = categories.join(' ').toLowerCase();
  if (/\bcartas?\b|\bcard\b/.test(haystack)) return 'cards';
  if (/\brpg\b/.test(haystack)) return 'rpg';
  if (tpJogo === 'b') return 'board';
  return 'other';
}

function names(items: Array<{ nm_profissional?: string }> | undefined): string[] {
  return (items ?? []).map((i) => i.nm_profissional).filter((n): n is string => Boolean(n));
}

/** The thin row from /jogos search: no type, no players, no play time. */
export function fromSearchResult(jogo: LudopediaJogoResumo) {
  return {
    ludopediaId: jogo.id_jogo,
    name: jogo.nm_jogo ?? `Jogo ${jogo.id_jogo}`,
    originalName: jogo.nm_original ?? null,
    thumbnail: jogo.thumb ?? null,
    coverUrl: coverFromThumb(jogo.thumb),
    link: absoluteLink(jogo.link),
    year: jogo.ano_publicacao ?? null,
    detailed: false,
  };
}

/** The full sheet from /jogos/{id}. */
export function fromDetail(jogo: LudopediaJogo) {
  const categories = (jogo.categorias ?? [])
    .map((c) => c.nm_categoria)
    .filter((n): n is string => Boolean(n));

  return {
    ludopediaId: jogo.id_jogo,
    name: jogo.nm_jogo ?? `Jogo ${jogo.id_jogo}`,
    originalName: jogo.nm_original ?? null,
    type: inferGameType(jogo.tp_jogo, categories),
    thumbnail: jogo.thumb ?? null,
    coverUrl: coverFromThumb(jogo.thumb),
    link: absoluteLink(jogo.link),
    // Prefer the Brazilian release year — this is a Brazilian catalog.
    year: jogo.ano_nacional ?? jogo.ano_publicacao ?? null,
    minPlayers: jogo.qt_jogadores_min ?? null,
    maxPlayers: jogo.qt_jogadores_max ?? null,
    playTimeMinutes: jogo.vl_tempo_jogo ?? null,
    minAge: jogo.idade_minima ?? null,
    ownedCount: jogo.qt_tem ?? null,
    wantedCount: jogo.qt_quer ?? null,
    favoriteCount: jogo.qt_favorito ?? null,
    playedCount: jogo.qt_jogou ?? null,
    mechanics: (jogo.mecanicas ?? []).map((m) => m.nm_mecanica).filter((n): n is string => Boolean(n)),
    categories,
    themes: (jogo.temas ?? []).map((t) => t.nm_tema).filter((n): n is string => Boolean(n)),
    designers: names(jogo.designers),
    artists: names(jogo.artistas),
    detailed: true,
  };
}

/** Row → public DTO. The internal uuid stays behind; callers get `publicId`. */
export function toGame(row: GameRow): Game {
  return {
    publicId: row.publicId,
    ludopediaId: row.ludopediaId,
    name: row.name,
    originalName: row.originalName,
    type: row.type,
    thumbnail: row.thumbnail,
    coverUrl: row.coverUrl,
    link: row.link,
    year: row.year,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    playTimeMinutes: row.playTimeMinutes,
    minAge: row.minAge,
    detailed: row.detailed,
  };
}

export function toGameDetail(row: GameRow): GameDetail {
  return {
    ...toGame(row),
    mechanics: row.mechanics,
    categories: row.categories,
    themes: row.themes,
    designers: row.designers,
    artists: row.artists,
    ownedCount: row.ownedCount,
    wantedCount: row.wantedCount,
    favoriteCount: row.favoriteCount,
    playedCount: row.playedCount,
  };
}
