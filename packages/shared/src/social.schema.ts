import { z } from 'zod';
import {
  LIMITS,
  friendshipStatusSchema,
  gameTypeFilterSchema,
  groupMemberStatusSchema,
  groupRoleSchema,
  groupVisibilitySchema,
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
  visibility: groupVisibilitySchema,
  isOwner: z.boolean(),
  /** The caller's role in this group (admins manage members). */
  myRole: groupRoleSchema,
  memberCount: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type FriendGroup = z.infer<typeof friendGroupSchema>;

/** A member as seen inside a group: the person, their role, and their status. */
export const groupMemberSchema = z.object({
  user: publicUserSchema,
  role: groupRoleSchema,
  status: groupMemberStatusSchema,
  isOwner: z.boolean(),
});
export type GroupMember = z.infer<typeof groupMemberSchema>;

export const friendGroupDetailSchema = friendGroupSchema.extend({
  /** Active members — the ones whose collections feed the shelf. */
  members: z.array(groupMemberSchema),
  /** Pending outgoing invites (admins only see these). */
  invited: z.array(groupMemberSchema),
  /** People who asked to join (admins only see these). */
  requests: z.array(groupMemberSchema),
  /** True when the caller can manage members (owner or admin). */
  canManage: z.boolean(),
});
export type FriendGroupDetail = z.infer<typeof friendGroupDetailSchema>;

export const createFriendGroupSchema = z
  .object({
    name: trimmed(LIMITS.groupName.min, LIMITS.groupName.max),
    visibility: groupVisibilitySchema.default('closed'),
    /** Seed the group with invites to these users. */
    memberIds: z.array(publicIdSchema).max(LIMITS.bulkItems).default([]),
  })
  .strict();
export type CreateFriendGroupInput = z.infer<typeof createFriendGroupSchema>;

export const updateFriendGroupSchema = z
  .object({
    name: trimmed(LIMITS.groupName.min, LIMITS.groupName.max).optional(),
    visibility: groupVisibilitySchema.optional(),
  })
  .strict();
export type UpdateFriendGroupInput = z.infer<typeof updateFriendGroupSchema>;

export const groupMemberIdsSchema = z
  .object({ memberIds: z.array(publicIdSchema).min(1).max(LIMITS.bulkItems) })
  .strict();
export type GroupMemberIdsInput = z.infer<typeof groupMemberIdsSchema>;

export const setGroupRoleSchema = z.object({ role: groupRoleSchema }).strict();
export type SetGroupRoleInput = z.infer<typeof setGroupRoleSchema>;

/** An invite the caller has received, for the notifications-style list. */
export const groupInviteSchema = z.object({
  group: friendGroupSchema,
  invitedBy: publicUserSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type GroupInvite = z.infer<typeof groupInviteSchema>;

// --- Group directory (discover + request to join) ---------------------------

export const groupDirectoryEntrySchema = z.object({
  publicId: publicIdSchema,
  name: z.string(),
  memberCount: z.number().int(),
  owner: publicUserSchema,
  /** The caller's standing with this group, so the UI shows the right action. */
  relation: z.enum(['member', 'invited', 'requested', 'none']),
  createdAt: z.iso.datetime(),
});
export type GroupDirectoryEntry = z.infer<typeof groupDirectoryEntrySchema>;

export const groupDirectoryQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(LIMITS.searchQuery.max).optional(),
});
export type GroupDirectoryQuery = z.infer<typeof groupDirectoryQuerySchema>;

export const groupDirectoryResultSchema = pageOf(groupDirectoryEntrySchema);

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
  /** Same type filter as the lists. */
  type: gameTypeFilterSchema.default('all'),
  /** Narrow to games a specific member owns. */
  ownerId: publicIdSchema.optional(),
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
