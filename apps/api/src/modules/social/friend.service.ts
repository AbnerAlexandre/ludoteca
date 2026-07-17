import { and, count, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { FriendRequest, Page, PublicUser, UserSearchQuery } from '@ludoteca/shared';
import { db } from '../../db/index.js';
import { friendships, users, type UserRow } from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { toPublicUser } from '../users/user.mapper.js';
import { acceptedFriendIds, friendshipBetween, friendshipInvolves, relationsFor } from './friendship.service.js';

/**
 * User search (spec §5.2). Matches login and display name only — never email.
 * Searching by email would turn this into a "does this person have an account"
 * oracle for any address an attacker holds.
 */
export async function searchUsers(viewer: UserRow, query: UserSearchQuery): Promise<Page<PublicUser>> {
  const term = `%${query.q}%`;
  const where = and(
    ne(users.id, viewer.id),
    or(sql`${users.login} ilike ${term}`, sql`${users.displayName} ilike ${term}`),
  )!;

  const [totalRow] = await db.select({ value: count() }).from(users).where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(users.login)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const relations = await relationsFor(viewer.id, rows.map((r) => r.id));

  return {
    items: rows.map((r) => toPublicUser(r, relations.get(r.id) ?? 'none')),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getUserByPublicId(publicId: string): Promise<UserRow> {
  const row = await db.query.users.findFirst({ where: eq(users.publicId, publicId) });
  if (!row) throw Errors.notFound('User');
  return row;
}

export async function friendsOf(viewer: UserRow, page: number, pageSize: number): Promise<Page<PublicUser>> {
  const ids = await acceptedFriendIds(viewer.id);
  if (ids.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }

  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(users.login)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map((r) => toPublicUser(r, 'friend')),
    page,
    pageSize,
    total: ids.length,
    totalPages: Math.max(1, Math.ceil(ids.length / pageSize)),
  };
}

/** Both directions of pending, so the UI can separate "respond" from "waiting". */
export async function pendingRequests(viewer: UserRow): Promise<FriendRequest[]> {
  const rows = await db
    .select({ friendship: friendships, other: users })
    .from(friendships)
    .innerJoin(
      users,
      sql`${users.id} = case when ${friendships.requesterId} = ${viewer.id}
        then ${friendships.addresseeId} else ${friendships.requesterId} end`,
    )
    .where(and(friendshipInvolves(viewer.id), eq(friendships.status, 'pending')))
    .orderBy(desc(friendships.createdAt));

  return rows.map((r) => ({
    publicId: r.friendship.publicId,
    user: toPublicUser(r.other, r.friendship.requesterId === viewer.id ? 'request_sent' : 'request_received'),
    direction: r.friendship.requesterId === viewer.id ? ('outgoing' as const) : ('incoming' as const),
    status: r.friendship.status,
    createdAt: r.friendship.createdAt.toISOString(),
  }));
}

export async function sendRequest(
  request: FastifyRequest,
  viewer: UserRow,
  targetPublicId: string,
): Promise<FriendRequest> {
  const target = await getUserByPublicId(targetPublicId);
  if (target.id === viewer.id) throw Errors.badRequest('You cannot add yourself.');

  const existing = await db.query.friendships.findFirst({
    where: friendshipBetween(viewer.id, target.id),
  });

  if (existing) {
    if (existing.status === 'accepted') throw Errors.conflict('You are already friends.');
    // They already asked us — treat a request back as an accept rather than
    // leaving two people staring at each other's pending requests.
    if (existing.addresseeId === viewer.id) {
      return acceptRequest(request, viewer, existing.publicId);
    }
    throw Errors.conflict('A request is already pending.');
  }

  const [row] = await db
    .insert(friendships)
    .values({ publicId: newPublicId(), requesterId: viewer.id, addresseeId: target.id, status: 'pending' })
    .returning();
  if (!row) throw Errors.conflict('Could not send the request.');

  await audit(request, 'friend.request_sent', { userId: viewer.id });
  return {
    publicId: row.publicId,
    user: toPublicUser(target, 'request_sent'),
    direction: 'outgoing',
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Only the addressee may accept — otherwise the requester could accept their
 * own request and befriend anyone unilaterally.
 */
export async function acceptRequest(
  request: FastifyRequest,
  viewer: UserRow,
  friendshipPublicId: string,
): Promise<FriendRequest> {
  const row = await db.query.friendships.findFirst({
    where: eq(friendships.publicId, friendshipPublicId),
  });
  if (!row || row.addresseeId !== viewer.id || row.status !== 'pending') {
    throw Errors.notFound('Request');
  }

  const [updated] = await db
    .update(friendships)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(eq(friendships.id, row.id))
    .returning();
  if (!updated) throw Errors.notFound('Request');

  const other = await db.query.users.findFirst({ where: eq(users.id, row.requesterId) });
  if (!other) throw Errors.notFound('User');

  await audit(request, 'friend.request_accepted', { userId: viewer.id });
  return {
    publicId: updated.publicId,
    user: toPublicUser(other, 'friend'),
    direction: 'incoming',
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  };
}

/**
 * Rejecting and unfriending are the same operation: drop the row. Either party
 * may do it — you can always withdraw your own request or end a friendship.
 */
export async function removeFriendship(
  request: FastifyRequest,
  viewer: UserRow,
  friendshipPublicId: string,
): Promise<void> {
  const deleted = await db
    .delete(friendships)
    .where(and(eq(friendships.publicId, friendshipPublicId), friendshipInvolves(viewer.id)))
    .returning({ id: friendships.id });
  if (deleted.length === 0) throw Errors.notFound('Request');
  await audit(request, 'friend.removed', { userId: viewer.id });
}

/** Unfriend addressed by user rather than by friendship id, which the UI has handy. */
export async function unfriendUser(
  request: FastifyRequest,
  viewer: UserRow,
  targetPublicId: string,
): Promise<void> {
  const target = await getUserByPublicId(targetPublicId);
  const deleted = await db
    .delete(friendships)
    .where(friendshipBetween(viewer.id, target.id))
    .returning({ id: friendships.id });
  if (deleted.length === 0) throw Errors.notFound('Friendship');
  await audit(request, 'friend.removed', { userId: viewer.id });
}
