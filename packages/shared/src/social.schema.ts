import { z } from 'zod';
import {
  LIMITS,
  friendshipStatusSchema,
  loanStatusSchema,
  pageOf,
  paginationSchema,
  publicIdSchema,
  trimmed,
} from './common.js';
import { gameSchema } from './game.schema.js';
import { publicUserSchema } from './user.schema.js';

// --- Friendships ------------------------------------------------------------

export const friendRequestSchema = z.object({
  publicId: publicIdSchema,
  user: publicUserSchema,
  /** 'incoming' = they asked us; 'outgoing' = we asked them. */
  direction: z.enum(['incoming', 'outgoing']),
  status: friendshipStatusSchema,
  createdAt: z.iso.datetime(),
});
export type FriendRequest = z.infer<typeof friendRequestSchema>;

export const sendFriendRequestSchema = z.object({ userId: publicIdSchema }).strict();
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;

export const friendsListSchema = pageOf(publicUserSchema);

// --- Friend groups ----------------------------------------------------------

export const friendGroupSchema = z.object({
  publicId: publicIdSchema,
  name: z.string(),
  isOwner: z.boolean(),
  memberCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type FriendGroup = z.infer<typeof friendGroupSchema>;

export const friendGroupDetailSchema = friendGroupSchema.extend({
  members: z.array(publicUserSchema),
});
export type FriendGroupDetail = z.infer<typeof friendGroupDetailSchema>;

export const createFriendGroupSchema = z
  .object({
    name: trimmed(LIMITS.groupName.min, LIMITS.groupName.max),
    memberIds: z.array(publicIdSchema).max(LIMITS.bulkItems).default([]),
  })
  .strict();
export type CreateFriendGroupInput = z.infer<typeof createFriendGroupSchema>;

export const updateFriendGroupSchema = z
  .object({ name: trimmed(LIMITS.groupName.min, LIMITS.groupName.max) })
  .strict();
export type UpdateFriendGroupInput = z.infer<typeof updateFriendGroupSchema>;

export const groupMemberIdsSchema = z
  .object({ memberIds: z.array(publicIdSchema).min(1).max(LIMITS.bulkItems) })
  .strict();
export type GroupMemberIdsInput = z.infer<typeof groupMemberIdsSchema>;

/**
 * The point of a group: one row per game across every member's collection,
 * with the owners attributed. Only items whose privacy lets the caller see
 * them contribute to `owners` — a game can appear with fewer owners than
 * actually hold it, and that's the correct, privacy-preserving answer.
 */
export const groupGameSchema = z.object({
  game: gameSchema,
  owners: z.array(publicUserSchema),
  ownerCount: z.number().int(),
});
export type GroupGame = z.infer<typeof groupGameSchema>;

export const groupGamesQuerySchema = paginationSchema.extend({
  sort: z.enum(['name', 'owners', 'type']).default('name'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(LIMITS.searchQuery.max).optional(),
});
export type GroupGamesQuery = z.infer<typeof groupGamesQuerySchema>;

export const groupGamesResultSchema = pageOf(groupGameSchema);

// --- Loans ------------------------------------------------------------------

export const loanSchema = z.object({
  publicId: publicIdSchema,
  game: gameSchema,
  lender: publicUserSchema,
  borrower: publicUserSchema,
  status: loanStatusSchema,
  /** 'lending' = caller owns the game; 'borrowing' = caller holds it. */
  role: z.enum(['lending', 'borrowing']),
  note: z.string().nullable(),
  requestedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  returnedAt: z.iso.datetime().nullable(),
  dueAt: z.iso.datetime().nullable(),
});
export type Loan = z.infer<typeof loanSchema>;

/**
 * Two entry points into the same table: an owner lending a game out, or a
 * friend asking to borrow one. Both land as a row; `status` differs.
 */
export const createLoanSchema = z
  .object({
    gameId: publicIdSchema,
    /** The other party. Combined with `intent` it resolves to lender/borrower. */
    counterpartId: publicIdSchema,
    intent: z.enum(['lend', 'borrow']),
    note: z.string().trim().max(LIMITS.note.max).optional(),
    dueAt: z.iso.datetime().optional(),
  })
  .strict();
export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const loansQuerySchema = paginationSchema.extend({
  status: z.enum(['all', 'requested', 'active', 'returned']).default('all'),
  role: z.enum(['all', 'lending', 'borrowing']).default('all'),
});
export type LoansQuery = z.infer<typeof loansQuerySchema>;

export const loansResultSchema = pageOf(loanSchema);
