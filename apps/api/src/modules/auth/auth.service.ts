import { eq, or, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { DeleteAccountInput, LoginInput, RegisterInput } from '@ludoteca/shared';
import { db } from '../../db/index.js';
import { lists, users, type UserRow } from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { fakeVerify, hashPassword, verifyPassword } from '../../lib/password.js';
import { newPublicId } from '../../lib/public-id.js';
import { applyProgressiveDelay, checkLockout, clearFailures, recordFailure } from './lockout.js';
import { revokeAllSessions } from './tokens.js';

/** Seeded for every new account so the app is never an empty shell. */
const DEFAULT_LISTS = [
  { kind: 'collection' as const, name: 'Meus Jogos' },
  { kind: 'wishlist' as const, name: 'Quero Comprar' },
  { kind: 'favorites' as const, name: 'Favoritos' },
];

async function createDefaultLists(userId: string, tx: typeof db = db): Promise<void> {
  await tx.insert(lists).values(
    DEFAULT_LISTS.map((l) => ({
      publicId: newPublicId(),
      ownerId: userId,
      name: l.name,
      kind: l.kind,
      isSystem: true,
    })),
  );
}

export async function register(request: FastifyRequest, input: RegisterInput): Promise<UserRow> {
  const passwordHash = await hashPassword(input.password);

  // We check uniqueness by *attempting the insert* and reading the constraint
  // violation, rather than querying first: a pre-check is both racy and an
  // enumeration oracle. The unique indexes are case-insensitive on lower(...).
  let created: UserRow | undefined;
  try {
    const rows = await db
      .insert(users)
      .values({
        publicId: newPublicId(),
        login: input.login,
        email: input.email,
        passwordHash,
      })
      .returning();
    created = rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) {
      await audit(request, 'auth.register', { metadata: { outcome: 'duplicate' } });
      // Deliberately vague and identical for login-taken and email-taken:
      // a precise message here is a free account-existence check.
      throw Errors.conflict('Could not create the account with those details.');
    }
    throw err;
  }

  if (!created) throw Errors.conflict('Could not create the account.');

  await createDefaultLists(created.id);
  await audit(request, 'auth.register', { userId: created.id });
  return created;
}

export async function login(request: FastifyRequest, input: LoginInput): Promise<UserRow> {
  const { identifier, password } = input;

  const state = await checkLockout(identifier);
  if (state.lockedForSeconds > 0) {
    await audit(request, 'auth.locked_out');
    throw Errors.lockedOut(state.lockedForSeconds);
  }
  await applyProgressiveDelay(state);

  const identifierLower = identifier.toLowerCase();
  const user = await db.query.users.findFirst({
    where: or(sql`lower(${users.login}) = ${identifierLower}`, sql`lower(${users.email}) = ${identifierLower}`),
  });

  // No account, or a Google-only account with no password to check. Burn the
  // same argon2 time a real verification costs, so response latency doesn't
  // separate "no such user" from "wrong password".
  if (!user?.passwordHash) {
    await fakeVerify();
    await recordFailure(request, identifier);
    await audit(request, 'auth.login_failed', { metadata: { reason: 'unknown_or_passwordless' } });
    throw Errors.invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    await recordFailure(request, identifier);
    await audit(request, 'auth.login_failed', { userId: user.id, metadata: { reason: 'bad_password' } });
    throw Errors.invalidCredentials();
  }

  await clearFailures(identifier);
  const [updated] = await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  await audit(request, 'auth.login', { userId: user.id });
  return updated ?? user;
}

export async function changePassword(
  request: FastifyRequest,
  user: UserRow,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // A Google-only account has no current password to prove; it must go through
  // a reset flow instead of setting one from an authenticated session.
  if (!user.passwordHash) throw Errors.badRequest('This account has no password set.');
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw Errors.invalidCredentials();
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Changing a password is how you evict someone who has your session.
  await revokeAllSessions(user.id);
  await audit(request, 'auth.password_changed', { userId: user.id });
}

/**
 * Hard delete, per spec §5.1. Everything the user owns goes with them via
 * ON DELETE CASCADE (lists, items, friendships, groups, loans, tokens); the
 * audit trail survives because audit_log.user_id is ON DELETE SET NULL.
 */
export async function deleteAccount(
  request: FastifyRequest,
  user: UserRow,
  input: DeleteAccountInput,
): Promise<void> {
  if (user.passwordHash) {
    if (!input.password) throw Errors.badRequest('Password is required to delete the account.');
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw Errors.invalidCredentials();
    }
  }

  // Record it *before* the row disappears — after the delete there is no
  // user id left to attribute the event to.
  await audit(request, 'account.deleted', {
    userId: user.id,
    metadata: { login: user.login },
  });
  await db.delete(users).where(eq(users.id, user.id));
}

export async function findByGoogleId(googleId: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(users.googleId, googleId) });
}

/**
 * Google sign-in resolution, per spec §5.1: match an existing account by email
 * and link it, otherwise create one. Only ever called with an email Google has
 * told us is verified — linking on an unverified address would let anyone
 * claim an account by registering that address at Google.
 */
export async function linkOrCreateGoogleUser(
  request: FastifyRequest,
  profile: { googleId: string; email: string; name?: string | null; picture?: string | null },
): Promise<UserRow> {
  const existingByGoogle = await findByGoogleId(profile.googleId);
  if (existingByGoogle) return existingByGoogle;

  const existingByEmail = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${profile.email.toLowerCase()}`,
  });

  if (existingByEmail) {
    const [linked] = await db
      .update(users)
      .set({
        googleId: profile.googleId,
        googleConnected: true,
        avatarUrl: existingByEmail.avatarUrl ?? profile.picture ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id))
      .returning();
    return linked ?? existingByEmail;
  }

  const [created] = await db
    .insert(users)
    .values({
      publicId: newPublicId(),
      login: await deriveAvailableLogin(profile.email),
      email: profile.email,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      googleId: profile.googleId,
      googleConnected: true,
      // No passwordHash: the users_has_credential check is satisfied by googleId.
      passwordHash: null,
    })
    .returning();

  if (!created) throw Errors.conflict('Could not create the account.');
  await createDefaultLists(created.id);
  await audit(request, 'auth.register', { userId: created.id, metadata: { provider: 'google' } });
  return created;
}

/** Turns an email local-part into a login that's free, without ever colliding. */
async function deriveAvailableLogin(email: string): Promise<string> {
  const base = (email.split('@')[0] ?? 'player').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24) || 'player';
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 10_000)}`;
    if (candidate.length < 3) continue;
    const taken = await db.query.users.findFirst({
      where: sql`lower(${users.login}) = ${candidate.toLowerCase()}`,
    });
    if (!taken) return candidate;
  }
  return `player${Date.now().toString(36)}`.slice(0, 32);
}

/**
 * Postgres unique-violation SQLSTATE (23505).
 *
 * Drizzle wraps driver errors in a DrizzleQueryError, so the SQLSTATE sits on
 * `cause`, not on the thrown error itself. Missing it is not a cosmetic bug:
 * the raw error escapes as an unhandled 500 whose message embeds the failed
 * query *and its bound parameters* — which for a registration insert includes
 * the password hash. Walk the whole chain.
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let current: unknown = err, depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current && current.code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
