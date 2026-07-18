import { and, count, eq, inArray } from 'drizzle-orm';
import type { Privacy, UserProfile } from '@ludoteca/shared';
import { db } from '../../db/index.js';
import { listItems, lists, users, type UserRow } from '../../db/schema.js';
import { Errors } from '../../lib/errors.js';
import { areFriends, relationBetween } from '../social/friendship.service.js';
import { toPublicUser } from './user.mapper.js';

/**
 * A user's public profile.
 *
 * Everything here is filtered through the same privacy lens as the rest of the
 * app: a list's item count reflects only what THIS viewer may see, and a list
 * whose every item is hidden from them doesn't appear at all. So the profile
 * can never become a way around the per-item privacy rules — the numbers add
 * up to exactly what the viewer could already reach by opening each list.
 */
export async function userProfile(viewer: UserRow | null, targetPublicId: string): Promise<UserProfile> {
  const target = await db.query.users.findFirst({ where: eq(users.publicId, targetPublicId) });
  if (!target) throw Errors.notFound('User');

  const isSelf = viewer?.id === target.id;
  const friend = viewer && !isSelf ? await areFriends(viewer.id, target.id) : false;

  // Which privacy levels the viewer may see on this user's items.
  const visible: Privacy[] = isSelf
    ? ['public', 'friends', 'nobody']
    : friend
      ? ['public', 'friends']
      : ['public'];

  // The user's lists, each with the count of items visible to this viewer.
  const listRows = await db
    .select({
      list: lists,
      visibleItemCount: count(listItems.id),
    })
    .from(lists)
    .leftJoin(
      listItems,
      and(eq(listItems.listId, lists.id), inArray(listItems.privacy, visible)),
    )
    .where(eq(lists.ownerId, target.id))
    .groupBy(lists.id)
    .orderBy(lists.createdAt);

  // Hide lists that have nothing visible — unless it's your own profile, where
  // you see all of your (possibly empty) lists.
  const shownLists = listRows.filter((r) => isSelf || r.visibleItemCount > 0);

  // Headline stat: distinct games visible in the collection list.
  const collection = listRows.find((r) => r.list.kind === 'collection');
  const visibleGameCount = collection?.visibleItemCount ?? 0;

  const relation = viewer ? await relationBetween(viewer.id, target.id) : 'none';

  return {
    user: toPublicUser(target, relation),
    memberSince: target.createdAt.toISOString(),
    visibleGameCount,
    lists: shownLists.map((r) => ({
      publicId: r.list.publicId,
      name: r.list.name,
      kind: r.list.kind,
      visibleItemCount: r.visibleItemCount,
    })),
  };
}
