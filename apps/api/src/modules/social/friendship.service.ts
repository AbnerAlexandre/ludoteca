import { and, eq, or, sql } from 'drizzle-orm';
import type { PublicUser } from '@ludoteca/shared';
import { db } from '../../db/index.js';
import { friendships } from '../../db/schema.js';

/**
 * Friendship is symmetric, but the table is directional: whoever sent the
 * request is `requester`. Every read therefore has to look at both columns —
 * a query that only checks one direction silently loses half the friendships.
 */
const involves = (userId: string) =>
  or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId));

const between = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await db.query.friendships.findFirst({
    where: and(between(a, b), eq(friendships.status, 'accepted')),
  });
  return row !== undefined;
}

/** Accepted friends only — pending requests grant no visibility. */
export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      // Pick whichever column isn't the caller.
      friendId: sql<string>`case when ${friendships.requesterId} = ${userId}
        then ${friendships.addresseeId} else ${friendships.requesterId} end`,
    })
    .from(friendships)
    .where(and(involves(userId), eq(friendships.status, 'accepted')));

  return rows.map((r) => r.friendId);
}

/** Drives which action button the UI shows next to a user. */
export async function relationBetween(
  viewerId: string | null,
  otherId: string,
): Promise<PublicUser['relation']> {
  if (!viewerId) return 'none';
  if (viewerId === otherId) return 'self';

  const row = await db.query.friendships.findFirst({ where: between(viewerId, otherId) });
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friend';
  return row.requesterId === viewerId ? 'request_sent' : 'request_received';
}

/** Batch form of relationBetween — one query for a whole page of results. */
export async function relationsFor(
  viewerId: string | null,
  otherIds: string[],
): Promise<Map<string, PublicUser['relation']>> {
  const relations = new Map<string, PublicUser['relation']>();
  if (!viewerId || otherIds.length === 0) {
    for (const id of otherIds) relations.set(id, 'none');
    return relations;
  }

  const rows = await db.select().from(friendships).where(involves(viewerId));
  for (const id of otherIds) {
    if (id === viewerId) {
      relations.set(id, 'self');
      continue;
    }
    const row = rows.find((r) => r.requesterId === id || r.addresseeId === id);
    if (!row) relations.set(id, 'none');
    else if (row.status === 'accepted') relations.set(id, 'friend');
    else relations.set(id, row.requesterId === viewerId ? 'request_sent' : 'request_received');
  }
  return relations;
}

export { between as friendshipBetween, involves as friendshipInvolves };
