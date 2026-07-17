import type { Me, PublicUser } from '@ludoteca/shared';
import type { UserRow } from '../../db/schema.js';

/**
 * The boundary between a database row and what leaves the process. Routes never
 * hand a raw row to `reply.send` — the row carries `id`, `passwordHash` and
 * `googleId`, none of which may ever cross the wire.
 */
export function toMe(user: UserRow): Me {
  return {
    publicId: user.publicId,
    login: user.login,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    defaultGamePrivacy: user.defaultGamePrivacy,
    googleConnected: user.googleConnected,
    hasPassword: user.passwordHash !== null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * What one user may see of another. Note the absence of `email`: exposing it
 * would turn user search into an address harvester.
 */
export function toPublicUser(user: UserRow, relation: PublicUser['relation'] = 'none'): PublicUser {
  return {
    publicId: user.publicId,
    login: user.login,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    relation,
  };
}
