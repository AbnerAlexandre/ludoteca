import { and, asc, count, countDistinct, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type {
  CreateFriendGroupInput,
  FriendGroup,
  FriendGroupDetail,
  GroupGame,
  GroupGamesQuery,
  Page,
} from '@ludoteca/shared';
import { db } from '../../db/index.js';
import {
  friendGroupMembers,
  friendGroups,
  games,
  listItems,
  lists,
  users,
  type FriendGroupRow,
  type UserRow,
} from '../../db/schema.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { toGame } from '../games/game.mapper.js';
import { toPublicUser } from '../users/user.mapper.js';
import { acceptedFriendIds, relationsFor } from './friendship.service.js';

/**
 * A group is visible to its owner and its members. Anyone else gets a 404 —
 * not a 403, which would confirm the group id is real.
 */
async function getVisibleGroup(viewer: UserRow, groupPublicId: string): Promise<FriendGroupRow> {
  const group = await db.query.friendGroups.findFirst({
    where: eq(friendGroups.publicId, groupPublicId),
  });
  if (!group) throw Errors.notFound('Group');
  if (group.ownerId === viewer.id) return group;

  const membership = await db.query.friendGroupMembers.findFirst({
    where: and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, viewer.id)),
  });
  if (!membership) throw Errors.notFound('Group');
  return group;
}

async function getOwnedGroup(viewer: UserRow, groupPublicId: string): Promise<FriendGroupRow> {
  const group = await db.query.friendGroups.findFirst({
    where: eq(friendGroups.publicId, groupPublicId),
  });
  if (!group || group.ownerId !== viewer.id) throw Errors.notFound('Group');
  return group;
}

export async function groupsFor(viewer: UserRow): Promise<FriendGroup[]> {
  const rows = await db
    .select({ group: friendGroups, memberCount: count(friendGroupMembers.userId) })
    .from(friendGroups)
    .leftJoin(friendGroupMembers, eq(friendGroupMembers.groupId, friendGroups.id))
    // Groups you own, plus groups you've been added to.
    .where(
      sql`${friendGroups.ownerId} = ${viewer.id} or exists (
        select 1 from ${friendGroupMembers} m
        where m.group_id = ${friendGroups.id} and m.user_id = ${viewer.id}
      )`,
    )
    .groupBy(friendGroups.id)
    .orderBy(asc(friendGroups.createdAt));

  return rows.map((r) => ({
    publicId: r.group.publicId,
    name: r.group.name,
    isOwner: r.group.ownerId === viewer.id,
    memberCount: r.memberCount,
    createdAt: r.group.createdAt.toISOString(),
  }));
}

export async function groupDetail(viewer: UserRow, groupPublicId: string): Promise<FriendGroupDetail> {
  const group = await getVisibleGroup(viewer, groupPublicId);
  const memberRows = await db
    .select({ user: users })
    .from(friendGroupMembers)
    .innerJoin(users, eq(users.id, friendGroupMembers.userId))
    .where(eq(friendGroupMembers.groupId, group.id))
    .orderBy(users.login);

  const relations = await relationsFor(viewer.id, memberRows.map((r) => r.user.id));

  return {
    publicId: group.publicId,
    name: group.name,
    isOwner: group.ownerId === viewer.id,
    memberCount: memberRows.length,
    createdAt: group.createdAt.toISOString(),
    members: memberRows.map((r) => toPublicUser(r.user, relations.get(r.user.id) ?? 'none')),
  };
}

/**
 * Only accepted friends can be added. Without this check a group would be a way
 * to pull a stranger's collection into your view by naming their id — the
 * privacy rules below trust group membership, so membership itself has to be
 * earned through a friendship.
 */
async function assertAllAreFriends(viewer: UserRow, memberPublicIds: string[]): Promise<string[]> {
  if (memberPublicIds.length === 0) return [];

  const rows = await db.select().from(users).where(inArray(users.publicId, memberPublicIds));
  if (rows.length !== memberPublicIds.length) throw Errors.notFound('User');

  const friendIds = new Set(await acceptedFriendIds(viewer.id));
  for (const row of rows) {
    if (row.id === viewer.id) continue;
    if (!friendIds.has(row.id)) throw Errors.badRequest('You can only add friends to a group.');
  }
  return rows.map((r) => r.id);
}

export async function createGroup(viewer: UserRow, input: CreateFriendGroupInput): Promise<FriendGroupDetail> {
  const memberIds = await assertAllAreFriends(viewer, input.memberIds);

  const [group] = await db
    .insert(friendGroups)
    .values({ publicId: newPublicId(), ownerId: viewer.id, name: input.name })
    .returning();
  if (!group) throw Errors.conflict('Could not create the group.');

  // The owner is always a member — a group of your friends that excludes you
  // would show you everyone's games but never your own.
  const ids = new Set([viewer.id, ...memberIds]);
  await db
    .insert(friendGroupMembers)
    .values([...ids].map((userId) => ({ groupId: group.id, userId })))
    .onConflictDoNothing();

  return groupDetail(viewer, group.publicId);
}

export async function renameGroup(viewer: UserRow, groupPublicId: string, name: string): Promise<FriendGroupDetail> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  await db.update(friendGroups).set({ name, updatedAt: new Date() }).where(eq(friendGroups.id, group.id));
  return groupDetail(viewer, group.publicId);
}

export async function deleteGroup(viewer: UserRow, groupPublicId: string): Promise<void> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  await db.delete(friendGroups).where(eq(friendGroups.id, group.id));
}

export async function addMembers(
  viewer: UserRow,
  groupPublicId: string,
  memberPublicIds: string[],
): Promise<FriendGroupDetail> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  const memberIds = await assertAllAreFriends(viewer, memberPublicIds);
  await db
    .insert(friendGroupMembers)
    .values(memberIds.map((userId) => ({ groupId: group.id, userId })))
    .onConflictDoNothing();
  return groupDetail(viewer, group.publicId);
}

export async function removeMembers(
  viewer: UserRow,
  groupPublicId: string,
  memberPublicIds: string[],
): Promise<FriendGroupDetail> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  const rows = await db.select().from(users).where(inArray(users.publicId, memberPublicIds));
  const ids = rows.map((r) => r.id).filter((id) => id !== viewer.id); // The owner can't leave their own group.
  if (ids.length > 0) {
    await db
      .delete(friendGroupMembers)
      .where(and(eq(friendGroupMembers.groupId, group.id), inArray(friendGroupMembers.userId, ids)));
  }
  return groupDetail(viewer, group.publicId);
}

/**
 * The point of a group (spec §5.2): every game owned across the members, with
 * the owners attributed.
 *
 * The privacy clause is the subtle part. A member's item counts toward the
 * aggregate only if the viewer may see *that item*:
 *   - it's the viewer's own item, or
 *   - it's public, or
 *   - it's friends-only AND the viewer is actually that member's friend.
 *
 * Being in a group together is NOT friendship. Two people can share a group via
 * the owner without being friends with each other, so a `friends` item must not
 * leak to them. The result is intentionally asymmetric: two members can see
 * different owner lists for the same game, and each is correct.
 */
export async function groupGames(
  viewer: UserRow,
  groupPublicId: string,
  query: GroupGamesQuery,
): Promise<Page<GroupGame>> {
  const group = await getVisibleGroup(viewer, groupPublicId);
  const viewerFriendIds = await acceptedFriendIds(viewer.id);

  // Built with inArray rather than an interpolated `in (...)`: drizzle binds an
  // array in a sql`` template as ONE parameter, which would compare a uuid
  // against an array and quietly match nothing.
  const friendsClause: SQL =
    viewerFriendIds.length > 0
      ? and(eq(listItems.privacy, 'friends'), inArray(lists.ownerId, viewerFriendIds))!
      : sql`false`;

  const visibleToViewer: SQL = or(
    eq(lists.ownerId, viewer.id),
    eq(listItems.privacy, 'public'),
    friendsClause,
  )!;

  const clauses: SQL[] = [
    eq(friendGroupMembers.groupId, group.id),
    // Only real collections count as "owning" a game — a wishlist is a list of
    // games you explicitly do NOT have.
    eq(lists.kind, 'collection'),
    visibleToViewer,
  ];
  if (query.q) clauses.push(sql`${games.name} ilike ${`%${query.q}%`}`);
  const where = and(...clauses)!;

  const base = db
    .select({ gameId: games.id })
    .from(friendGroupMembers)
    .innerJoin(lists, eq(lists.ownerId, friendGroupMembers.userId))
    .innerJoin(listItems, eq(listItems.listId, lists.id))
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(where)
    .groupBy(games.id);

  const totalRows = await base;
  const total = totalRows.length;

  const dir = query.dir === 'asc' ? asc : desc;
  const orderBy =
    query.sort === 'owners'
      ? [dir(countDistinct(friendGroupMembers.userId)), asc(sql`lower(${games.name})`)]
      : query.sort === 'type'
        ? [dir(games.type), asc(sql`lower(${games.name})`)]
        : [dir(sql`lower(${games.name})`)];

  const pageRows = await db
    .select({ game: games, ownerCount: countDistinct(friendGroupMembers.userId) })
    .from(friendGroupMembers)
    .innerJoin(lists, eq(lists.ownerId, friendGroupMembers.userId))
    .innerJoin(listItems, eq(listItems.listId, lists.id))
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(where)
    .groupBy(games.id)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  if (pageRows.length === 0) {
    return { items: [], page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
  }

  // Second pass: who owns each game on this page. Scoped to the page's games so
  // this stays one small query rather than one per row.
  const gameIds = pageRows.map((r) => r.game.id);
  const ownerRows = await db
    .selectDistinct({ gameId: games.id, owner: users })
    .from(friendGroupMembers)
    .innerJoin(users, eq(users.id, friendGroupMembers.userId))
    .innerJoin(lists, eq(lists.ownerId, friendGroupMembers.userId))
    .innerJoin(listItems, eq(listItems.listId, lists.id))
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(and(where, inArray(games.id, gameIds))!)
    .orderBy(users.login);

  const relations = await relationsFor(viewer.id, [...new Set(ownerRows.map((r) => r.owner.id))]);
  const ownersByGame = new Map<string, ReturnType<typeof toPublicUser>[]>();
  for (const row of ownerRows) {
    const list = ownersByGame.get(row.gameId) ?? [];
    list.push(toPublicUser(row.owner, relations.get(row.owner.id) ?? 'none'));
    ownersByGame.set(row.gameId, list);
  }

  return {
    items: pageRows.map((r) => ({
      game: toGame(r.game),
      owners: ownersByGame.get(r.game.id) ?? [],
      ownerCount: r.ownerCount,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
