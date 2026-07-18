import { z } from 'zod';
import { LIMITS, listKindSchema, paginationSchema, pageOf, privacySchema, publicIdSchema, trimmed } from './common.js';

export const loginSchema = trimmed(LIMITS.login.min, LIMITS.login.max).regex(
  /^[a-zA-Z0-9._-]+$/,
  'Use only letters, numbers, dot, underscore or hyphen',
);

export const emailSchema = z.email().max(LIMITS.email.max).toLowerCase().trim();

/**
 * 12 chars minimum. Length beats composition rules for real-world entropy, so
 * we require length and check nothing else beyond a sane ceiling (argon2 is
 * slow enough that unbounded input is a DoS vector).
 */
export const passwordSchema = z.string().min(LIMITS.password.min).max(LIMITS.password.max);

/** The authenticated user's own profile — includes settings only they may see. */
export const meSchema = z.object({
  publicId: publicIdSchema,
  login: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  defaultGamePrivacy: privacySchema,
  googleConnected: z.boolean(),
  hasPassword: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Me = z.infer<typeof meSchema>;

/** What anyone else is allowed to see. Note: no email, no timestamps. */
export const publicUserSchema = z.object({
  publicId: publicIdSchema,
  login: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  /** Relationship to the caller, so the UI can render the right action. */
  relation: z.enum(['self', 'friend', 'request_sent', 'request_received', 'none']),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const userSearchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(LIMITS.searchQuery.min).max(LIMITS.searchQuery.max),
});
export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;

/**
 * A user's public profile. Each list carries the count of items *this viewer*
 * is allowed to see, so a profile never reveals more than the privacy rules
 * permit — and lists whose every item is hidden don't appear at all.
 */
export const profileListSchema = z.object({
  publicId: publicIdSchema,
  name: z.string(),
  kind: listKindSchema,
  visibleItemCount: z.number().int(),
});
export type ProfileList = z.infer<typeof profileListSchema>;

export const userProfileSchema = z.object({
  user: publicUserSchema,
  memberSince: z.iso.datetime(),
  /** Total games visible across the collection, for the headline stat. */
  visibleGameCount: z.number().int(),
  lists: z.array(profileListSchema),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const userSearchResultSchema = pageOf(publicUserSchema);

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(LIMITS.displayName.max).nullable().optional(),
    defaultGamePrivacy: privacySchema.optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(LIMITS.password.max),
    newPassword: passwordSchema,
  })
  .strict();
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Account deletion is irreversible, so it demands the password *and* a typed
 * confirmation phrase — no one deletes an account by mis-clicking.
 */
export const deleteAccountSchema = z
  .object({
    password: z.string().min(1).max(LIMITS.password.max).optional(),
    confirm: z.literal('DELETE'),
  })
  .strict();
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
