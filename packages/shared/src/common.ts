import { z } from 'zod';
import { LIMITS, PUBLIC_ID_LENGTH } from './constants.js';

// Re-exported so server-side code can keep importing everything from the
// barrel. The browser imports these from '@ludoteca/shared/constants' instead,
// which costs it no zod — see constants.ts.
export { LIMITS, PUBLIC_ID_LENGTH };

/**
 * Opaque public identifier. Internal uuid/serial ids never cross the API
 * boundary — see SECURITY.md ("IDOR / enumeration").
 */
export const publicIdSchema = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${PUBLIC_ID_LENGTH}}$`), 'Invalid identifier');
export type PublicId = z.infer<typeof publicIdSchema>;

export const privacySchema = z.enum(['friends', 'public', 'nobody']);
export type Privacy = z.infer<typeof privacySchema>;

export const gameTypeSchema = z.enum(['board', 'cards', 'expansion', 'rpg', 'other']);
export type GameType = z.infer<typeof gameTypeSchema>;

export const listKindSchema = z.enum(['collection', 'wishlist', 'favorites', 'custom']);
export type ListKind = z.infer<typeof listKindSchema>;

export const friendshipStatusSchema = z.enum(['pending', 'accepted']);
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;

export const loanStatusSchema = z.enum(['requested', 'active', 'returned']);
export type LoanStatus = z.infer<typeof loanStatusSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const listItemSortSchema = z.enum(['name', 'added_at', 'type', 'year']);
export type ListItemSort = z.infer<typeof listItemSortSchema>;

/** Coerces `?page=2` (always a string on the wire) into a bounded integer. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(LIMITS.pageSize.min)
    .max(LIMITS.pageSize.max)
    .default(LIMITS.pageSize.default),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });

/**
 * The single error shape the API ever returns. Messages are deliberately
 * generic: no stack traces, no internal ids, no "user not found" vs
 * "wrong password" distinction.
 */
export const errorCodeSchema = z.enum([
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation_failed',
  'rate_limited',
  'upstream_unavailable',
  'internal_error',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /** Field-level detail, present only for `validation_failed`. */
    fields: z.record(z.string(), z.string()).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof okSchema>;

/** Trims, then rejects empty — avoids "   " passing a min(1) check. */
export const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
