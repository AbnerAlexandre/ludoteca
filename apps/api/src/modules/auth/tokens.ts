import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH_COOKIES } from '@ludoteca/shared';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { refreshTokens, type UserRow } from '../../db/schema.js';
import { Errors } from '../../lib/errors.js';
import { baseCookieOptions } from '../../plugins/10-cookies.js';

/**
 * The refresh cookie is scoped to the auth routes. It's the long-lived
 * credential, so it should not ride along on every /api/lists call where a
 * proxy or a stray log could catch it.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Refresh tokens are opaque random bytes, not JWTs: they must be revocable,
 * and a self-contained token can't be. We store an HMAC rather than the token
 * itself, peppered with a server-side secret — so a read-only database leak
 * yields nothing usable without also stealing JWT_REFRESH_SECRET.
 */
function hashToken(raw: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(raw).digest('hex');
}

function newRawToken(): string {
  return randomBytes(32).toString('base64url');
}

async function persistRefreshToken(userId: string, familyId: string): Promise<string> {
  const raw = newRawToken();
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + refreshTtlMs),
  });
  return raw;
}

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  reply.setCookie(AUTH_COOKIES.access, accessToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60, // Cookie outlives the JWT slightly; the JWT's exp is what rules.
  });
  reply.setCookie(AUTH_COOKIES.refresh, refreshToken, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: Math.floor(refreshTtlMs / 1000),
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIES.access, { ...baseCookieOptions });
  reply.clearCookie(AUTH_COOKIES.refresh, { ...baseCookieOptions, path: REFRESH_COOKIE_PATH });
  reply.clearCookie(AUTH_COOKIES.csrf, { ...baseCookieOptions, httpOnly: false });
}

/** Mints a brand new session — a fresh family, unrelated to any prior login. */
export async function issueSession(
  request: FastifyRequest,
  reply: FastifyReply,
  user: UserRow,
): Promise<string> {
  const accessToken = await reply.jwtSign({ sub: user.publicId });
  const refreshToken = await persistRefreshToken(user.id, randomUUID());
  setAuthCookies(reply, accessToken, refreshToken);

  // The SPA can't read the httpOnly cookies, so hand it the CSRF token to echo.
  const csrfToken = reply.generateCsrf();
  request.log.debug({ userId: user.publicId }, 'session issued');
  return csrfToken;
}

/**
 * Rotation with reuse detection. Every refresh burns the presented token and
 * issues its successor within the same family. If a token that was already
 * rotated comes back, it means someone kept a copy — the token was stolen, and
 * we can't tell whether the caller is the thief or the victim. So we revoke the
 * entire family and force a fresh login. See SECURITY.md ("session model").
 */
export async function rotateSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ user: UserRow; csrfToken: string }> {
  const raw = request.cookies[AUTH_COOKIES.refresh];
  if (!raw) throw Errors.sessionExpired();

  const presented = hashToken(raw);
  const row = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, presented),
  });

  if (!row) {
    clearAuthCookies(reply);
    throw Errors.sessionExpired();
  }

  if (row.revokedAt) {
    request.log.warn({ familyId: row.familyId }, 'refresh token reuse — revoking family');
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
    clearAuthCookies(reply);
    throw Errors.sessionExpired();
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    clearAuthCookies(reply);
    throw Errors.sessionExpired();
  }

  const user = await db.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, row.userId) });
  if (!user) {
    clearAuthCookies(reply);
    throw Errors.sessionExpired();
  }

  const nextRaw = newRawToken();
  const nextHash = hashToken(nextRaw);
  const [next] = await db
    .insert(refreshTokens)
    .values({
      userId: user.id,
      familyId: row.familyId,
      tokenHash: nextHash,
      expiresAt: new Date(Date.now() + refreshTtlMs),
    })
    .returning();

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date(), replacedById: next?.id ?? null })
    .where(eq(refreshTokens.id, row.id));

  const accessToken = await reply.jwtSign({ sub: user.publicId });
  setAuthCookies(reply, accessToken, nextRaw);
  return { user, csrfToken: reply.generateCsrf() };
}

/** Ends one session (this device). Other families keep working. */
export async function revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const raw = request.cookies[AUTH_COOKIES.refresh];
  if (raw) {
    const row = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hashToken(raw)),
    });
    if (row) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
    }
  }
  clearAuthCookies(reply);
}

/** Ends every session for a user — used on password change and account deletion. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Housekeeping: drop rows that are expired or long since revoked. */
export async function pruneRefreshTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(refreshTokens)
    .where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, cutoff)))
    .returning({ id: refreshTokens.id });
  return deleted.length;
}

/** Constant-time compare for anything secret we ever match by hand. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
