import { createHmac } from 'node:crypto';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { loginAttempts } from '../../db/schema.js';

/**
 * Brute-force protection, per spec §6.6. The rate limiter caps request volume
 * per key; this caps *failures* per account, which is the thing that actually
 * matters — an attacker rotating IPs slips past a per-IP limit but still has
 * to fail against one login to guess its password.
 *
 * The counters are advisory: they slow guessing down enough to be useless
 * without ever locking a real user out for long.
 */
const WINDOW_MINUTES = 15;
const DELAY_AFTER = 3;
const LOCK_AFTER = 8;
const LOCK_SECONDS = 15 * 60;
const MAX_DELAY_MS = 2_000;

/**
 * We never store the identifier someone typed — a failed-login table is an
 * email list otherwise, and people mistype their password into the login field.
 */
function identifierKey(identifier: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(identifier.trim().toLowerCase())
    .digest('hex');
}

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

export interface LockoutState {
  failures: number;
  lockedForSeconds: number;
}

export async function checkLockout(identifier: string): Promise<LockoutState> {
  const [row] = await db
    .select({ failures: count() })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.identifierHash, identifierKey(identifier)), gt(loginAttempts.createdAt, windowStart())),
    );

  const failures = row?.failures ?? 0;
  return {
    failures,
    lockedForSeconds: failures >= LOCK_AFTER ? LOCK_SECONDS : 0,
  };
}

/**
 * Progressive delay: 3 failures cost nothing, then each further miss adds
 * ~250ms up to a 2s ceiling. Capped deliberately — an uncapped delay would let
 * an attacker tie up our own connections by failing on purpose.
 */
export async function applyProgressiveDelay(state: LockoutState): Promise<void> {
  if (state.failures < DELAY_AFTER) return;
  const delay = Math.min((state.failures - DELAY_AFTER + 1) * 250, MAX_DELAY_MS);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function recordFailure(request: FastifyRequest, identifier: string): Promise<void> {
  await db.insert(loginAttempts).values({
    identifierHash: identifierKey(identifier),
    ip: request.ip.slice(0, 45),
  });
}

/** A successful login wipes the slate so a user isn't punished for typos. */
export async function clearFailures(identifier: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.identifierHash, identifierKey(identifier)));
}

/** Housekeeping: attempts outside the window carry no information. */
export async function pruneLoginAttempts(): Promise<number> {
  const deleted = await db
    .delete(loginAttempts)
    .where(sql`${loginAttempts.createdAt} < ${windowStart()}`)
    .returning({ id: loginAttempts.id });
  return deleted.length;
}
