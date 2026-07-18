import { and, asc, count, countDistinct, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type {
  CreateFriendGroupInput,
  FriendGroup,
  FriendGroupDetail,
  GameType,
  GroupDirectoryEntry,
  GroupDirectoryQuery,
  GroupGame,
  GroupGamesQuery,
  GroupInvite,
  GroupMember,
  GroupRole,
  Page,
  UpdateFriendGroupInput,
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
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { toGame } from '../games/game.mapper.js';
import { toPublicUser } from '../users/user.mapper.js';
import { acceptedFriendIds, relationsFor } from './friendship.service.js';

type MembershipRow = typeof friendGroupMembers.$inferSelect;

// --- Authorization helpers --------------------------------------------------

async function getGroup(groupPublicId: string): Promise<FriendGroupRow> {
  const group = await db.query.friendGroups.findFirst({ where: eq(friendGroups.publicId, groupPublicId) });
  if (!group) throw Errors.notFound('Group');
  return group;
}

function membershipOf(groupId: string, userId: string): Promise<MembershipRow | undefined> {
  return db.query.friendGroupMembers.findFirst({
    where: and(eq(friendGroupMembers.groupId, groupId), eq(friendGroupMembers.userId, userId)),
  });
}

/**
 * A group is visible to its owner and its ACTIVE members. Everyone else gets a
 * 404, not a 403 — a 403 would confirm the id is real. An invited-but-not-yet-
 * accepted user can't browse the shelf; they can only accept the invite.
 */
async function getVisibleGroup(
  viewer: UserRow,
  groupPublicId: string,
): Promise<{ group: FriendGroupRow; membership: MembershipRow | undefined }> {
  const group = await getGroup(groupPublicId);
  const membership = await membershipOf(group.id, viewer.id);
  const isActiveMember = membership?.status === 'active';
  if (group.ownerId !== viewer.id && !isActiveMember) throw Errors.notFound('Group');
  return { group, membership };
}

/** Owner or an active admin — the people who can manage members. */
async function getManagedGroup(
  viewer: UserRow,
  groupPublicId: string,
): Promise<{ group: FriendGroupRow; isOwner: boolean }> {
  const group = await getGroup(groupPublicId);
  if (group.ownerId === viewer.id) return { group, isOwner: true };
  const membership = await membershipOf(group.id, viewer.id);
  if (membership?.status === 'active' && membership.role === 'admin') return { group, isOwner: false };
  // Hide management endpoints from non-managers behind the same 404.
  throw Errors.notFound('Group');
}

async function getOwnedGroup(viewer: UserRow, groupPublicId: string): Promise<FriendGroupRow> {
  const group = await getGroup(groupPublicId);
  if (group.ownerId !== viewer.id) throw Errors.notFound('Group');
  return group;
}

// --- Mappers ----------------------------------------------------------------

function toSummary(group: FriendGroupRow, membership: MembershipRow | undefined, activeCount: number): FriendGroup {
  const isOwner = membership ? group.ownerId === membership.userId : false;
  return {
    publicId: group.publicId,
    name: group.name,
    visibility: group.visibility,
    isOwner,
    myRole: membership?.role ?? 'member',
    memberCount: activeCount,
    createdAt: group.createdAt.toISOString(),
  };
}

function toGroupMember(user: UserRow, m: MembershipRow, ownerId: string, relation: GroupMember['user']['relation']): GroupMember {
  return {
    user: toPublicUser(user, relation),
    role: m.role,
    status: m.status,
    isOwner: user.id === ownerId,
  };
}

// --- Reads ------------------------------------------------------------------

/** Groups the caller actively belongs to (owned or joined). */
export async function groupsFor(viewer: UserRow): Promise<FriendGroup[]> {
  const rows = await db
    .select({ group: friendGroups, membership: friendGroupMembers })
    .from(friendGroupMembers)
    .innerJoin(friendGroups, eq(friendGroups.id, friendGroupMembers.groupId))
    .where(and(eq(friendGroupMembers.userId, viewer.id), eq(friendGroupMembers.status, 'active')))
    .orderBy(asc(friendGroups.createdAt));

  const counts = await activeCounts(rows.map((r) => r.group.id));
  return rows.map((r) => toSummary(r.group, r.membership, counts.get(r.group.id) ?? 0));
}

/** Invites the caller has received but not yet accepted. */
export async function invitesFor(viewer: UserRow): Promise<GroupInvite[]> {
  const rows = await db
    .select({ group: friendGroups, membership: friendGroupMembers })
    .from(friendGroupMembers)
    .innerJoin(friendGroups, eq(friendGroups.id, friendGroupMembers.groupId))
    .where(and(eq(friendGroupMembers.userId, viewer.id), eq(friendGroupMembers.status, 'invited')))
    .orderBy(desc(friendGroupMembers.addedAt));

  const counts = await activeCounts(rows.map((r) => r.group.id));
  const inviterIds = rows.map((r) => r.membership.invitedById).filter((id): id is string => id !== null);
  const inviters = inviterIds.length
    ? new Map((await db.select().from(users).where(inArray(users.id, inviterIds))).map((u) => [u.id, u]))
    : new Map<string, UserRow>();

  return rows.map((r) => {
    const inviter = r.membership.invitedById ? inviters.get(r.membership.invitedById) : undefined;
    return {
      group: toSummary(r.group, r.membership, counts.get(r.group.id) ?? 0),
      invitedBy: inviter ? toPublicUser(inviter) : null,
      createdAt: r.membership.addedAt.toISOString(),
    };
  });
}

async function activeCounts(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({ groupId: friendGroupMembers.groupId, n: count() })
    .from(friendGroupMembers)
    .where(and(inArray(friendGroupMembers.groupId, groupIds), eq(friendGroupMembers.status, 'active')))
    .groupBy(friendGroupMembers.groupId);
  return new Map(rows.map((r) => [r.groupId, r.n]));
}

export async function groupDetail(viewer: UserRow, groupPublicId: string): Promise<FriendGroupDetail> {
  const { group, membership } = await getVisibleGroup(viewer, groupPublicId);
  const canManage = group.ownerId === viewer.id || membership?.role === 'admin';

  const rows = await db
    .select({ user: users, membership: friendGroupMembers })
    .from(friendGroupMembers)
    .innerJoin(users, eq(users.id, friendGroupMembers.userId))
    .where(eq(friendGroupMembers.groupId, group.id))
    .orderBy(desc(friendGroupMembers.role), users.login);

  const relations = await relationsFor(viewer.id, rows.map((r) => r.user.id));
  const asMember = (r: (typeof rows)[number]) =>
    toGroupMember(r.user, r.membership, group.ownerId, relations.get(r.user.id) ?? 'none');

  const active = rows.filter((r) => r.membership.status === 'active').map(asMember);

  return {
    ...toSummary(group, membership, active.length),
    canManage,
    members: active,
    // Invites and requests are management concerns — only shown to managers.
    invited: canManage ? rows.filter((r) => r.membership.status === 'invited').map(asMember) : [],
    requests: canManage ? rows.filter((r) => r.membership.status === 'requested').map(asMember) : [],
  };
}

/**
 * Open groups the caller could join. Their own groups are excluded; each entry
 * carries the caller's current relation so the UI shows Entrar / Pendente / etc.
 */
export async function directory(viewer: UserRow, query: GroupDirectoryQuery): Promise<Page<GroupDirectoryEntry>> {
  const clauses: SQL[] = [eq(friendGroups.visibility, 'open')];
  if (query.q) clauses.push(sql`${friendGroups.name} ilike ${`%${query.q}%`}`);
  const where = and(...clauses)!;

  const [totalRow] = await db.select({ value: count() }).from(friendGroups).where(where);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({ group: friendGroups, owner: users, memberCount: count(friendGroupMembers.userId) })
    .from(friendGroups)
    .innerJoin(users, eq(users.id, friendGroups.ownerId))
    .leftJoin(
      friendGroupMembers,
      and(eq(friendGroupMembers.groupId, friendGroups.id), eq(friendGroupMembers.status, 'active')),
    )
    .where(where)
    .groupBy(friendGroups.id, users.id)
    .orderBy(desc(count(friendGroupMembers.userId)), asc(friendGroups.name))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  // One query for the caller's memberships across this page of groups.
  const groupIds = rows.map((r) => r.group.id);
  const myMemberships = groupIds.length
    ? new Map(
        (
          await db
            .select()
            .from(friendGroupMembers)
            .where(and(eq(friendGroupMembers.userId, viewer.id), inArray(friendGroupMembers.groupId, groupIds)))
        ).map((m) => [m.groupId, m]),
      )
    : new Map<string, MembershipRow>();

  const relation = (m: MembershipRow | undefined): GroupDirectoryEntry['relation'] => {
    if (!m) return 'none';
    if (m.status === 'active') return 'member';
    if (m.status === 'invited') return 'invited';
    return 'requested';
  };

  return {
    items: rows.map((r) => ({
      publicId: r.group.publicId,
      name: r.group.name,
      memberCount: r.memberCount,
      owner: toPublicUser(r.owner),
      relation: relation(myMemberships.get(r.group.id)),
      createdAt: r.group.createdAt.toISOString(),
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

// --- Writes -----------------------------------------------------------------

/** Resolve public ids to user rows, erroring if any is unknown. */
async function resolveUsers(publicIds: string[]): Promise<UserRow[]> {
  if (publicIds.length === 0) return [];
  const rows = await db.select().from(users).where(inArray(users.publicId, publicIds));
  if (rows.length !== new Set(publicIds).size) throw Errors.notFound('User');
  return rows;
}

export async function createGroup(
  request: FastifyRequest,
  viewer: UserRow,
  input: CreateFriendGroupInput,
): Promise<FriendGroupDetail> {
  const invitees = await resolveUsers(input.memberIds);

  const [group] = await db
    .insert(friendGroups)
    .values({ publicId: newPublicId(), ownerId: viewer.id, name: input.name, visibility: input.visibility })
    .returning();
  if (!group) throw Errors.conflict('Could not create the group.');

  // The owner is an active admin from the start.
  await db.insert(friendGroupMembers).values({
    groupId: group.id,
    userId: viewer.id,
    role: 'admin',
    status: 'active',
  });

  // Everyone else is invited — they choose whether to join. Inviting anyone is
  // safe: the shelf still only shows each viewer the items privacy allows.
  const others = invitees.filter((u) => u.id !== viewer.id);
  if (others.length > 0) {
    await db
      .insert(friendGroupMembers)
      .values(
        others.map((u) => ({
          groupId: group.id,
          userId: u.id,
          role: 'member' as const,
          status: 'invited' as const,
          invitedById: viewer.id,
        })),
      )
      .onConflictDoNothing();
  }

  await audit(request, 'friend.request_sent', { userId: viewer.id, metadata: { group: group.publicId } });
  return groupDetail(viewer, group.publicId);
}

export async function updateGroup(
  viewer: UserRow,
  groupPublicId: string,
  input: UpdateFriendGroupInput,
): Promise<FriendGroupDetail> {
  const { group } = await getManagedGroup(viewer, groupPublicId);
  await db
    .update(friendGroups)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      updatedAt: new Date(),
    })
    .where(eq(friendGroups.id, group.id));
  return groupDetail(viewer, group.publicId);
}

export async function deleteGroup(viewer: UserRow, groupPublicId: string): Promise<void> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  await db.delete(friendGroups).where(eq(friendGroups.id, group.id));
}

/** Admin invites people. Existing active members are left untouched. */
export async function inviteMembers(
  viewer: UserRow,
  groupPublicId: string,
  memberPublicIds: string[],
): Promise<FriendGroupDetail> {
  const { group } = await getManagedGroup(viewer, groupPublicId);
  const invitees = await resolveUsers(memberPublicIds);

  for (const u of invitees) {
    if (u.id === viewer.id) continue;
    const existing = await membershipOf(group.id, u.id);
    if (existing?.status === 'active') continue; // already in
    if (existing?.status === 'requested') {
      // They already asked — an invite from an admin is an approval.
      await db
        .update(friendGroupMembers)
        .set({ status: 'active' })
        .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, u.id)));
      continue;
    }
    await db
      .insert(friendGroupMembers)
      .values({ groupId: group.id, userId: u.id, role: 'member', status: 'invited', invitedById: viewer.id })
      .onConflictDoUpdate({
        target: [friendGroupMembers.groupId, friendGroupMembers.userId],
        set: { status: 'invited', invitedById: viewer.id },
      });
  }
  return groupDetail(viewer, group.publicId);
}

/** The invitee accepts: their membership flips invited → active. */
export async function acceptInvite(request: FastifyRequest, viewer: UserRow, groupPublicId: string): Promise<FriendGroupDetail> {
  const group = await getGroup(groupPublicId);
  const membership = await membershipOf(group.id, viewer.id);
  if (membership?.status !== 'invited') throw Errors.notFound('Invite');

  await db
    .update(friendGroupMembers)
    .set({ status: 'active' })
    .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, viewer.id)));
  await audit(request, 'friend.request_accepted', { userId: viewer.id, metadata: { group: group.publicId } });
  return groupDetail(viewer, group.publicId);
}

/** Any user asks to join an OPEN group; an admin must approve. */
export async function requestToJoin(request: FastifyRequest, viewer: UserRow, groupPublicId: string): Promise<void> {
  const group = await getGroup(groupPublicId);
  if (group.visibility !== 'open') throw Errors.notFound('Group');

  const existing = await membershipOf(group.id, viewer.id);
  if (existing?.status === 'active') throw Errors.conflict('You are already a member.');
  if (existing?.status === 'requested') throw Errors.conflict('Your request is already pending.');
  if (existing?.status === 'invited') {
    // They were invited and are asking to join — treat as accepting the invite.
    await db
      .update(friendGroupMembers)
      .set({ status: 'active' })
      .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, viewer.id)));
    return;
  }
  await db.insert(friendGroupMembers).values({
    groupId: group.id,
    userId: viewer.id,
    role: 'member',
    status: 'requested',
  });
  await audit(request, 'friend.request_sent', { userId: viewer.id, metadata: { group: group.publicId, kind: 'join' } });
}

/** Admin approves a pending join request. */
export async function approveRequest(
  viewer: UserRow,
  groupPublicId: string,
  targetPublicId: string,
): Promise<FriendGroupDetail> {
  const { group } = await getManagedGroup(viewer, groupPublicId);
  const [target] = await resolveUsers([targetPublicId]);
  if (!target) throw Errors.notFound('User');

  const membership = await membershipOf(group.id, target.id);
  if (membership?.status !== 'requested') throw Errors.notFound('Request');

  await db
    .update(friendGroupMembers)
    .set({ status: 'active' })
    .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, target.id)));
  return groupDetail(viewer, group.publicId);
}

/**
 * Remove someone from a group. Covers: an admin removing a member, rejecting a
 * request or revoking an invite; and a user leaving / declining / withdrawing
 * their own. The owner can never be removed.
 */
export async function removeMember(viewer: UserRow, groupPublicId: string, targetPublicId: string): Promise<void> {
  const group = await getGroup(groupPublicId);
  const [target] = await resolveUsers([targetPublicId]);
  if (!target) throw Errors.notFound('User');
  if (target.id === group.ownerId) throw Errors.badRequest('The group owner cannot be removed.');

  const isSelf = target.id === viewer.id;
  if (!isSelf) {
    // Removing someone else requires manage rights.
    await getManagedGroup(viewer, groupPublicId);
  } else {
    // Leaving requires you to actually have a membership row.
    const mine = await membershipOf(group.id, viewer.id);
    if (!mine) throw Errors.notFound('Group');
  }

  const deleted = await db
    .delete(friendGroupMembers)
    .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, target.id)))
    .returning({ userId: friendGroupMembers.userId });
  if (deleted.length === 0) throw Errors.notFound('Member');
}

/** Owner promotes/demotes a member between admin and member. */
export async function setMemberRole(
  viewer: UserRow,
  groupPublicId: string,
  targetPublicId: string,
  role: GroupRole,
): Promise<FriendGroupDetail> {
  const group = await getOwnedGroup(viewer, groupPublicId);
  const [target] = await resolveUsers([targetPublicId]);
  if (!target) throw Errors.notFound('User');
  if (target.id === group.ownerId) throw Errors.badRequest('The owner is always an admin.');

  const membership = await membershipOf(group.id, target.id);
  if (membership?.status !== 'active') throw Errors.notFound('Member');

  await db
    .update(friendGroupMembers)
    .set({ role })
    .where(and(eq(friendGroupMembers.groupId, group.id), eq(friendGroupMembers.userId, target.id)));
  return groupDetail(viewer, group.publicId);
}

// --- Aggregated shelf -------------------------------------------------------

/**
 * The point of a group: every game owned across the ACTIVE members, with the
 * owners attributed — subject to per-viewer privacy (see the friends clause).
 *
 * Now also filters by game type and by a single member, matching the list
 * filters plus the group-only "whose shelf" narrowing.
 */
export async function groupGames(
  viewer: UserRow,
  groupPublicId: string,
  query: GroupGamesQuery,
): Promise<Page<GroupGame>> {
  const { group } = await getVisibleGroup(viewer, groupPublicId);
  const viewerFriendIds = await acceptedFriendIds(viewer.id);

  const friendsClause: SQL =
    viewerFriendIds.length > 0
      ? and(eq(listItems.privacy, 'friends'), inArray(lists.ownerId, viewerFriendIds))!
      : sql`false`;
  const visibleToViewer: SQL = or(eq(lists.ownerId, viewer.id), eq(listItems.privacy, 'public'), friendsClause)!;

  const clauses: SQL[] = [
    eq(friendGroupMembers.groupId, group.id),
    // Only active members' collections count.
    eq(friendGroupMembers.status, 'active'),
    eq(lists.kind, 'collection'),
    visibleToViewer,
  ];
  if (query.q) clauses.push(sql`${games.name} ilike ${`%${query.q}%`}`);
  if (query.type !== 'all') clauses.push(eq(games.type, query.type as GameType));
  if (query.ownerId) {
    const [target] = await db.select().from(users).where(eq(users.publicId, query.ownerId));
    if (!target) throw Errors.notFound('Member');
    clauses.push(eq(friendGroupMembers.userId, target.id));
  }
  const where = and(...clauses)!;

  const totalRows = await db
    .select({ gameId: games.id })
    .from(friendGroupMembers)
    .innerJoin(lists, eq(lists.ownerId, friendGroupMembers.userId))
    .innerJoin(listItems, eq(listItems.listId, lists.id))
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(where)
    .groupBy(games.id);
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
