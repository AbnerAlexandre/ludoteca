import argon2 from 'argon2';

/**
 * argon2id with OWASP's recommended floor (19 MiB, 2 iterations, 1 lane).
 * Memory cost is what makes GPU cracking expensive, so it's the last knob to
 * lower if hashing ever needs to get cheaper.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed hash in the row must read as "wrong password", not as a 500.
    return false;
  }
}

/**
 * Burns roughly one argon2 verification's worth of time. Login calls this when
 * the account doesn't exist, so a missing account and a wrong password take the
 * same wall-clock time — otherwise response latency enumerates our users.
 */
export async function fakeVerify(): Promise<void> {
  await argon2.hash('timing-equalizer', ARGON2_OPTIONS);
}
