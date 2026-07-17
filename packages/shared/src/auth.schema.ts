import { z } from 'zod';
import { meSchema, emailSchema, loginSchema, passwordSchema } from './user.schema.js';

export const registerSchema = z
  .object({
    login: loginSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

/** `identifier` accepts either the login or the email — we don't tell which one matched. */
export const loginInputSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Tokens are never in the body — they live in httpOnly cookies the JS can't
 * read. The response carries only the profile and the CSRF token the SPA must
 * echo back on mutating requests (double-submit).
 */
export const authSessionSchema = z.object({
  user: meSchema,
  csrfToken: z.string(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authStatusSchema = z.object({
  authenticated: z.boolean(),
  user: meSchema.nullable(),
  csrfToken: z.string(),
  features: z.object({
    googleOAuth: z.boolean(),
  }),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

export { AUTH_COOKIES, CSRF_HEADER } from './constants.js';
