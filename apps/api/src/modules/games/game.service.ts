import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Game, GameSearchQuery, GameSearchResult } from '@ludoteca/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { games, type GameRow } from '../../db/schema.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { fromDetail, fromSearchResult, toGame } from './game.mapper.js';
import { isUnavailable, ludopedia } from './ludopedia.client.js';

const ttlMs = () => env.LUDOPEDIA_CACHE_TTL_HOURS * 60 * 60 * 1000;

function isStale(row: GameRow): boolean {
  return Date.now() - row.fetchedAt.getTime() > ttlMs();
}

/**
 * Writes search results into the catalog cache.
 *
 * The `where` clause matters: a search row is thin (no type, no players), so
 * without it, searching for a game already fully cached would overwrite its
 * detail with nulls. We only refresh the fields search actually knows, and only
 * when the stored row isn't already detailed.
 */
async function cacheSearchRows(rows: ReturnType<typeof fromSearchResult>[]): Promise<GameRow[]> {
  if (rows.length === 0) return [];

  await db
    .insert(games)
    .values(rows.map((r) => ({ publicId: newPublicId(), ...r })))
    .onConflictDoUpdate({
      target: games.ludopediaId,
      set: {
        name: sql`excluded.name`,
        originalName: sql`excluded.original_name`,
        thumbnail: sql`excluded.thumbnail`,
        coverUrl: sql`excluded.cover_url`,
        link: sql`excluded.link`,
        year: sql`coalesce(excluded.year, ${games.year})`,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      },
      where: eq(games.detailed, false),
    });

  const ids = rows.map((r) => r.ludopediaId);
  const stored = await db.select().from(games).where(inArray(games.ludopediaId, ids));

  // Preserve upstream's ordering (it ranks the results); the IN query doesn't.
  const byLudopediaId = new Map(stored.map((row) => [row.ludopediaId, row]));
  return ids.map((id) => byLudopediaId.get(id)).filter((row): row is GameRow => row !== undefined);
}

/**
 * Search, proxied. The client never learns Ludopedia's URL, field names, or
 * that our token exists — it gets our DTOs and nothing else (spec §3).
 *
 * When upstream is down we answer from the local cache and say so via
 * `upstreamAvailable`, rather than failing the screen outright.
 */
export async function searchGames(
  request: FastifyRequest,
  query: GameSearchQuery,
): Promise<GameSearchResult> {
  try {
    const upstream = await ludopedia.search(
      { q: query.q, type: query.type, page: query.page, rows: query.pageSize },
      request.log,
    );

    const rows = await cacheSearchRows(upstream.jogos.map(fromSearchResult));
    return {
      items: rows.map(toGame),
      page: query.page,
      pageSize: query.pageSize,
      total: upstream.total,
      totalPages: Math.max(1, Math.ceil(upstream.total / query.pageSize)),
      upstreamAvailable: true,
    };
  } catch (err) {
    if (!isUnavailable(err)) throw err;
    request.log.warn({ err: (err as Error).message }, 'ludopedia search failed — serving from cache');
    return searchCache(query);
  }
}

/** The degraded path: whatever we already know about, matched by name. */
async function searchCache(query: GameSearchQuery): Promise<GameSearchResult> {
  // ILIKE with a bound parameter — the `%` wrapping happens in the binding, so
  // the term is never concatenated into SQL.
  const term = `%${query.q}%`;
  const typeFilter =
    query.type === 'base'
      ? sql`${games.type} <> 'expansion'`
      : query.type === 'expansion'
        ? eq(games.type, 'expansion')
        : undefined;

  const where = typeFilter
    ? and(sql`${games.name} ilike ${term}`, typeFilter)
    : sql`${games.name} ilike ${term}`;

  const [totalRow] = await db.select({ value: count() }).from(games).where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select()
    .from(games)
    .where(where)
    .orderBy(games.name)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return {
    items: rows.map(toGame),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    upstreamAvailable: false,
  };
}

/**
 * Resolves a Ludopedia id to a cached, fully-detailed row, fetching upstream
 * only on a miss or when the TTL has lapsed. This is what list-item creation
 * calls, which is why every game in a list ends up with a real type and player
 * count even though search alone never returns them.
 */
export async function ensureGame(request: FastifyRequest, ludopediaId: number): Promise<GameRow> {
  const existing = await db.query.games.findFirst({ where: eq(games.ludopediaId, ludopediaId) });
  if (existing && existing.detailed && !isStale(existing)) return existing;

  let detail: ReturnType<typeof fromDetail>;
  try {
    detail = fromDetail(await ludopedia.detail(ludopediaId, request.log));
  } catch (err) {
    if (!isUnavailable(err)) throw err;
    // A stale-but-detailed row beats an error screen. Only fail when we have
    // nothing at all to show.
    if (existing) {
      request.log.warn({ ludopediaId }, 'serving stale game — ludopedia unavailable');
      return existing;
    }
    throw Errors.upstreamUnavailable('game detail fetch failed');
  }

  const [row] = await db
    .insert(games)
    .values({ publicId: newPublicId(), ...detail })
    .onConflictDoUpdate({
      target: games.ludopediaId,
      set: { ...detail, fetchedAt: new Date(), updatedAt: new Date() },
    })
    .returning();

  if (!row) throw Errors.upstreamUnavailable('could not cache the game');
  return row;
}

export async function getGameByPublicId(publicId: string): Promise<GameRow> {
  const row = await db.query.games.findFirst({ where: eq(games.publicId, publicId) });
  if (!row) throw Errors.notFound('Game');
  return row;
}

/** Refreshes the detail for a cached game if the caller asked for the full sheet. */
export async function getGameDetail(request: FastifyRequest, publicId: string): Promise<GameRow> {
  const row = await getGameByPublicId(publicId);
  if (row.detailed && !isStale(row)) return row;
  return ensureGame(request, row.ludopediaId);
}

export type { Game };
