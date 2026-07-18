import { z } from 'zod';
import {
  LIMITS,
  gameTypeFilterSchema,
  listItemSortSchema,
  listKindSchema,
  pageOf,
  paginationSchema,
  privacySchema,
  publicIdSchema,
  sortDirectionSchema,
  trimmed,
} from './common.js';
import { gameSchema } from './game.schema.js';

export const listSchema = z.object({
  publicId: publicIdSchema,
  name: z.string(),
  kind: listKindSchema,
  /** Seeded lists (collection/wishlist/favorites) can't be renamed or deleted. */
  isSystem: z.boolean(),
  itemCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type List = z.infer<typeof listSchema>;

export const listItemSchema = z.object({
  publicId: publicIdSchema,
  game: gameSchema,
  privacy: privacySchema,
  note: z.string().nullable(),
  addedAt: z.iso.datetime(),
  /**
   * The open loan on this copy, if any — null when it's on the shelf.
   *
   * Only ever set for the owner's own view: whether your game is out on loan
   * is between you and the borrower, so this stays null for anyone else.
   */
  loan: z
    .object({
      status: z.enum(['requested', 'active']),
      /** Who has it (or asked for it). */
      counterpartLogin: z.string(),
      dueAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export type ListItem = z.infer<typeof listItemSchema>;

export const createListSchema = z
  .object({
    name: trimmed(LIMITS.listName.min, LIMITS.listName.max),
  })
  .strict();
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = z
  .object({
    name: trimmed(LIMITS.listName.min, LIMITS.listName.max),
  })
  .strict();
export type UpdateListInput = z.infer<typeof updateListSchema>;

export const listItemsQuerySchema = paginationSchema.extend({
  sort: listItemSortSchema.default('added_at'),
  dir: sortDirectionSchema.default('desc'),
  /** Filter chips: narrow to a game type. */
  type: gameTypeFilterSchema.default('all'),
  /**
   * 'lent' = out with someone right now, 'available' = on the shelf.
   * Owner-only: for anyone else this filter has nothing to act on and is
   * ignored, because loan state isn't visible to them in the first place.
   */
  loan: z.enum(['all', 'lent', 'available']).default('all'),
  q: z.string().trim().max(LIMITS.searchQuery.max).optional(),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export const listItemsResultSchema = pageOf(listItemSchema);

export const addListItemSchema = z
  .object({
    /** Accepts a Ludopedia id so the client can add straight from search results. */
    ludopediaId: z.number().int().positive(),
    privacy: privacySchema.optional(),
    note: z.string().trim().max(LIMITS.note.max).optional(),
  })
  .strict();
export type AddListItemInput = z.infer<typeof addListItemSchema>;

export const updateListItemSchema = z
  .object({
    privacy: privacySchema.optional(),
    note: z.string().trim().max(LIMITS.note.max).nullable().optional(),
  })
  .strict();
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>;

/**
 * Bulk actions are capped at LIMITS.bulkItems ids per call: an uncapped array
 * is both a payload-size and a query-fanout amplifier.
 */
const bulkTargets = z.array(publicIdSchema).min(1).max(LIMITS.bulkItems);

export const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('remove'), itemIds: bulkTargets }).strict(),
  z.object({ action: z.literal('favorite'), itemIds: bulkTargets }).strict(),
  z
    .object({
      action: z.literal('copy_to_list'),
      itemIds: bulkTargets,
      targetListId: publicIdSchema,
    })
    .strict(),
  z
    .object({ action: z.literal('set_privacy'), itemIds: bulkTargets, privacy: privacySchema })
    .strict(),
]);
export type BulkActionInput = z.infer<typeof bulkActionSchema>;

export const bulkActionResultSchema = z.object({
  affected: z.number().int(),
  /** Ids skipped because they weren't the caller's or no longer exist. */
  skipped: z.number().int(),
});
export type BulkActionResult = z.infer<typeof bulkActionResultSchema>;

/**
 * `names` is a plain-text list of titles, one per line — for pasting straight
 * into WhatsApp. CSV in a chat window is unreadable, and most of the time the
 * question is just "what have you got?".
 */
export const exportFormatSchema = z.enum(['csv', 'json', 'names']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportQuerySchema = z.object({
  format: exportFormatSchema.default('csv'),
  /** Omit to export the whole list; provide ids to export just the selection. */
  itemIds: z
    .union([z.array(publicIdSchema), z.string()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v)),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
