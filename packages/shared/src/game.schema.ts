import { z } from 'zod';
import { LIMITS, gameTypeSchema, pageOf, paginationSchema, publicIdSchema } from './common.js';

/**
 * Our normalized game DTO. Ludopedia speaks Portuguese field names
 * (`id_jogo`, `nm_jogo`, `tp_jogo`...); the mapping lives in the API's
 * LudopediaService and never leaks past it.
 */
export const gameSchema = z.object({
  publicId: publicIdSchema,
  ludopediaId: z.number().int().positive(),
  name: z.string(),
  originalName: z.string().nullable(),
  type: gameTypeSchema,
  thumbnail: z.url().nullable(),
  coverUrl: z.url().nullable(),
  link: z.url().nullable(),
  year: z.number().int().nullable(),
  minPlayers: z.number().int().nullable(),
  maxPlayers: z.number().int().nullable(),
  playTimeMinutes: z.number().int().nullable(),
  minAge: z.number().int().nullable(),
  /** True once the full detail has been fetched; search-only rows are thin. */
  detailed: z.boolean(),
});
export type Game = z.infer<typeof gameSchema>;

export const gameDetailSchema = gameSchema.extend({
  mechanics: z.array(z.string()),
  categories: z.array(z.string()),
  themes: z.array(z.string()),
  designers: z.array(z.string()),
  artists: z.array(z.string()),
  /**
   * Ludopedia community counters — how many people own, want, favourite or have
   * played the game.
   *
   * These are NOT a rating and must not be presented as one: the API exposes no
   * score. Its /jogos/{id}/notas endpoint is a documented stub that returns the
   * literal string "notas e comentários;". Popularity is what's on offer.
   */
  ownedCount: z.number().int().nullable(),
  wantedCount: z.number().int().nullable(),
  favoriteCount: z.number().int().nullable(),
  playedCount: z.number().int().nullable(),
});
export type GameDetail = z.infer<typeof gameDetailSchema>;

export const gameSearchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(LIMITS.searchQuery.min).max(LIMITS.searchQuery.max),
  /** Maps to Ludopedia's `tp_jogo`: base games only, expansions only, or both. */
  type: z.enum(['all', 'base', 'expansion']).default('all'),
});
export type GameSearchQuery = z.infer<typeof gameSearchQuerySchema>;

export const gameSearchResultSchema = pageOf(gameSchema).extend({
  /**
   * False when Ludopedia was unreachable and we answered from the local cache
   * alone — the UI surfaces this instead of pretending the list is complete.
   */
  upstreamAvailable: z.boolean(),
});
export type GameSearchResult = z.infer<typeof gameSearchResultSchema>;
