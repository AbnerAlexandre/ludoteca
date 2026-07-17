import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type {
  AddListItemInput,
  BulkActionInput,
  BulkActionResult,
  List,
  ListItem,
  ListItemsQuery,
  Page,
  Privacy,
  UpdateListItemInput,
} from '@ludoteca/shared';
import { db } from '../../db/index.js';
import {
  games,
  listItems,
  lists,
  loans,
  users,
  type GameRow,
  type ListItemRow,
  type ListRow,
  type UserRow,
} from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { toGame } from '../games/game.mapper.js';
import { ensureGame } from '../games/game.service.js';
import { areFriends } from '../social/friendship.service.js';

/**
 * Resolves a list the caller is allowed to *write* to.
 *
 * Ownership is re-checked on every access rather than trusted from the URL —
 * the public id is unguessable, but "unguessable" is not an authorization
 * model (spec §6.4). A list that exists but belongs to someone else returns
 * the same 404 as one that doesn't exist, so the id space stays opaque.
 */
export async function getOwnedList(user: UserRow, listPublicId: string): Promise<ListRow> {
  const list = await db.query.lists.findFirst({ where: eq(lists.publicId, listPublicId) });
  if (!list || list.ownerId !== user.id) throw Errors.notFound('List');
  return list;
}

/**
 * Resolves a list the caller is allowed to *read*, and reports which privacy
 * levels they may see inside it.
 *
 * The owner sees everything. Anyone else sees public items, plus friends-only
 * items if they're actually a friend. `nobody` is owner-eyes-only, always.
 */
export async function getViewableList(
  viewer: UserRow | null,
  listPublicId: string,
): Promise<{ list: ListRow; visiblePrivacies: Privacy[]; isOwner: boolean }> {
  const list = await db.query.lists.findFirst({ where: eq(lists.publicId, listPublicId) });
  if (!list) throw Errors.notFound('List');

  if (viewer && list.ownerId === viewer.id) {
    return { list, visiblePrivacies: ['public', 'friends', 'nobody'], isOwner: true };
  }

  const friend = viewer ? await areFriends(viewer.id, list.ownerId) : false;
  const visiblePrivacies: Privacy[] = friend ? ['public', 'friends'] : ['public'];

  // A list whose every item is hidden from this viewer shouldn't advertise its
  // existence either.
  const [visible] = await db
    .select({ value: count() })
    .from(listItems)
    .where(and(eq(listItems.listId, list.id), inArray(listItems.privacy, visiblePrivacies)));

  if ((visible?.value ?? 0) === 0) throw Errors.notFound('List');
  return { list, visiblePrivacies, isOwner: false };
}

function toList(row: ListRow, itemCount: number): List {
  return {
    publicId: row.publicId,
    name: row.name,
    kind: row.kind,
    isSystem: row.isSystem,
    itemCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * `loan` is only ever passed for the owner's own view of their list. Whether a
 * game is out with someone — and with whom — is between the two of them, so it
 * stays null for every other viewer regardless of the item's privacy.
 */
function toListItem(item: ListItemRow, game: GameRow, loan?: ListItem['loan']): ListItem {
  return {
    publicId: item.publicId,
    game: toGame(game),
    privacy: item.privacy,
    note: item.note,
    addedAt: item.addedAt.toISOString(),
    loan: loan ?? null,
  };
}

/**
 * The caller's open loans (requested or active) as lender, keyed by game id.
 * One query for a whole page rather than a lookup per row.
 */
async function openLoansByGame(
  ownerId: string,
  gameIds: string[],
): Promise<Map<string, NonNullable<ListItem['loan']>>> {
  const map = new Map<string, NonNullable<ListItem['loan']>>();
  if (gameIds.length === 0) return map;

  const rows = await db
    .select({ loan: loans, borrower: users })
    .from(loans)
    .innerJoin(users, eq(users.id, loans.borrowerId))
    .where(
      and(eq(loans.lenderId, ownerId), inArray(loans.gameId, gameIds), ne(loans.status, 'returned'))!,
    );

  for (const row of rows) {
    // The partial unique index guarantees at most one open loan per game.
    if (row.loan.status === 'returned') continue;
    map.set(row.loan.gameId, {
      status: row.loan.status,
      counterpartLogin: row.borrower.login,
      dueAt: row.loan.dueAt?.toISOString() ?? null,
    });
  }
  return map;
}

export async function listsForUser(user: UserRow): Promise<List[]> {
  const rows = await db
    .select({
      list: lists,
      itemCount: count(listItems.id),
    })
    .from(lists)
    .leftJoin(listItems, eq(listItems.listId, lists.id))
    .where(eq(lists.ownerId, user.id))
    .groupBy(lists.id)
    // System lists first and in their seeded order, then custom lists by name.
    .orderBy(desc(lists.isSystem), asc(lists.createdAt));

  return rows.map((r) => toList(r.list, r.itemCount));
}

export async function createList(user: UserRow, name: string): Promise<List> {
  const [row] = await db
    .insert(lists)
    .values({ publicId: newPublicId(), ownerId: user.id, name, kind: 'custom', isSystem: false })
    .returning();
  if (!row) throw Errors.conflict('Could not create the list.');
  return toList(row, 0);
}

export async function renameList(user: UserRow, listPublicId: string, name: string): Promise<List> {
  const list = await getOwnedList(user, listPublicId);
  // The three seeded lists are structural — features key off `kind`, and the UI
  // routes to them by it. Renaming is fine; deleting or re-kinding is not.
  const [row] = await db
    .update(lists)
    .set({ name, updatedAt: new Date() })
    .where(eq(lists.id, list.id))
    .returning();
  if (!row) throw Errors.notFound('List');

  const [c] = await db.select({ value: count() }).from(listItems).where(eq(listItems.listId, list.id));
  return toList(row, c?.value ?? 0);
}

export async function deleteList(user: UserRow, listPublicId: string): Promise<void> {
  const list = await getOwnedList(user, listPublicId);
  if (list.isSystem) throw Errors.badRequest('Built-in lists cannot be deleted.');
  await db.delete(lists).where(eq(lists.id, list.id));
}

/** Sort mapping. An allowlist, not a column name from the query string. */
function orderFor(query: ListItemsQuery): SQL[] {
  const dir = query.dir === 'asc' ? asc : desc;
  switch (query.sort) {
    case 'name':
      return [dir(sql`lower(${games.name})`)];
    case 'type':
      // Secondary sort by name: without it, everything in a type bucket comes
      // back in whatever order Postgres feels like, which reshuffles between
      // pages and makes items appear to vanish.
      return [dir(games.type), asc(sql`lower(${games.name})`)];
    case 'year':
      // NULLS LAST has to follow the direction keyword, so the whole clause is
      // written out rather than wrapped in asc()/desc(). Games with no year
      // sink to the bottom either way, instead of leading an ascending sort.
      return [
        query.dir === 'asc' ? sql`${games.year} asc nulls last` : sql`${games.year} desc nulls last`,
        asc(sql`lower(${games.name})`),
      ];
    case 'added_at':
    default:
      return [dir(listItems.addedAt), asc(listItems.id)];
  }
}

function itemFilters(listId: string, visiblePrivacies: Privacy[], query: ListItemsQuery): SQL {
  const clauses: SQL[] = [
    eq(listItems.listId, listId),
    inArray(listItems.privacy, visiblePrivacies),
  ];
  if (query.type !== 'all') clauses.push(eq(games.type, query.type));
  if (query.q) clauses.push(sql`${games.name} ilike ${`%${query.q}%`}`);
  return and(...clauses)!;
}

/**
 * Attaches loan state and applies the loan filter.
 *
 * `ownerId` is non-null only when the caller owns the list. For anyone else the
 * rows come back with `loan: null` and the filter is a no-op — they can't see
 * loan state, so they can't filter by it either.
 */
async function withLoans(
  rows: Array<{ item: ListItemRow; game: GameRow }>,
  ownerId: string | null,
  loanFilter: ListItemsQuery['loan'],
): Promise<ListItem[]> {
  if (!ownerId) return rows.map((r) => toListItem(r.item, r.game));

  const loansByGame = await openLoansByGame(
    ownerId,
    rows.map((r) => r.game.id),
  );

  return rows
    .filter((r) => {
      if (loanFilter === 'all') return true;
      const lent = loansByGame.has(r.game.id);
      return loanFilter === 'lent' ? lent : !lent;
    })
    .map((r) => toListItem(r.item, r.game, loansByGame.get(r.game.id)));
}

export async function listItemsPage(
  listId: string,
  visiblePrivacies: Privacy[],
  query: ListItemsQuery,
  ownerId: string | null = null,
): Promise<Page<ListItem>> {
  const where = itemFilters(listId, visiblePrivacies, query);

  const rows = await db
    .select({ item: listItems, game: games })
    .from(listItems)
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(where)
    .orderBy(...orderFor(query));

  // The loan filter is applied in-process rather than in SQL: it needs the same
  // "one open loan per game" resolution the map already does, and a list is a
  // personal shelf — tens of rows, not thousands. Paginate after filtering so
  // the totals match what the user is actually looking at.
  const filtered = await withLoans(rows, ownerId, query.loan);
  const start = (query.page - 1) * query.pageSize;

  return {
    items: filtered.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
  };
}

/** Every row, unpaginated — for the SSE stream and for export. */
export async function allListItems(
  listId: string,
  visiblePrivacies: Privacy[],
  query: ListItemsQuery,
  ownerId: string | null = null,
): Promise<ListItem[]> {
  const rows = await db
    .select({ item: listItems, game: games })
    .from(listItems)
    .innerJoin(games, eq(games.id, listItems.gameId))
    .where(itemFilters(listId, visiblePrivacies, query))
    .orderBy(...orderFor(query));
  return withLoans(rows, ownerId, query.loan);
}

export async function addItem(
  request: FastifyRequest,
  user: UserRow,
  listPublicId: string,
  input: AddListItemInput,
): Promise<ListItem> {
  const list = await getOwnedList(user, listPublicId);
  // Resolves through the cache and fetches the full sheet on a miss, so items
  // in a list always have a real type and player count.
  const game = await ensureGame(request, input.ludopediaId);

  const [row] = await db
    .insert(listItems)
    .values({
      publicId: newPublicId(),
      listId: list.id,
      gameId: game.id,
      // New items inherit the account default unless overridden (spec §5.1).
      privacy: input.privacy ?? user.defaultGamePrivacy,
      note: input.note ?? null,
    })
    .onConflictDoNothing({ target: [listItems.listId, listItems.gameId] })
    .returning();

  if (!row) {
    // Already in this list. Idempotent rather than an error: the user's intent
    // ("I own this") is already satisfied.
    const existing = await db.query.listItems.findFirst({
      where: and(eq(listItems.listId, list.id), eq(listItems.gameId, game.id)),
    });
    if (!existing) throw Errors.conflict('Could not add the game.');
    return toListItem(existing, game);
  }

  return toListItem(row, game);
}

export async function updateItem(
  request: FastifyRequest,
  user: UserRow,
  listPublicId: string,
  itemPublicId: string,
  input: UpdateListItemInput,
): Promise<ListItem> {
  const list = await getOwnedList(user, listPublicId);
  const existing = await db.query.listItems.findFirst({
    where: and(eq(listItems.publicId, itemPublicId), eq(listItems.listId, list.id)),
  });
  if (!existing) throw Errors.notFound('Item');

  const [row] = await db
    .update(listItems)
    .set({
      ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    })
    .where(eq(listItems.id, existing.id))
    .returning();
  if (!row) throw Errors.notFound('Item');

  if (input.privacy && input.privacy !== existing.privacy) {
    await audit(request, 'privacy.item_changed', {
      metadata: { from: existing.privacy, to: input.privacy },
    });
  }

  const game = await db.query.games.findFirst({ where: eq(games.id, row.gameId) });
  if (!game) throw Errors.notFound('Game');
  return toListItem(row, game);
}

export async function removeItem(user: UserRow, listPublicId: string, itemPublicId: string): Promise<void> {
  const list = await getOwnedList(user, listPublicId);
  const deleted = await db
    .delete(listItems)
    .where(and(eq(listItems.publicId, itemPublicId), eq(listItems.listId, list.id)))
    .returning({ id: listItems.id });
  if (deleted.length === 0) throw Errors.notFound('Item');
}

/**
 * Bulk actions (spec §5.3).
 *
 * The scoping clause `listId = list.id` is the security control: the caller
 * supplies arbitrary item ids, and this is what stops a crafted payload from
 * touching someone else's items. Unmatched ids are counted as `skipped` rather
 * than raising — reporting *which* id was rejected would confirm it exists.
 */
export async function bulkAction(
  request: FastifyRequest,
  user: UserRow,
  listPublicId: string,
  input: BulkActionInput,
): Promise<BulkActionResult> {
  const list = await getOwnedList(user, listPublicId);
  const requested = input.itemIds.length;
  const scoped = and(eq(listItems.listId, list.id), inArray(listItems.publicId, input.itemIds))!;

  switch (input.action) {
    case 'remove': {
      const removed = await db.delete(listItems).where(scoped).returning({ id: listItems.id });
      return { affected: removed.length, skipped: requested - removed.length };
    }

    case 'set_privacy': {
      const updated = await db
        .update(listItems)
        .set({ privacy: input.privacy })
        .where(scoped)
        .returning({ id: listItems.id });
      await audit(request, 'privacy.item_changed', {
        metadata: { to: input.privacy, count: updated.length, bulk: true },
      });
      return { affected: updated.length, skipped: requested - updated.length };
    }

    case 'favorite': {
      const favorites = await db.query.lists.findFirst({
        where: and(eq(lists.ownerId, user.id), eq(lists.kind, 'favorites')),
      });
      if (!favorites) throw Errors.badRequest('You have no favorites list.');
      return copyItems(list.id, favorites.id, input.itemIds);
    }

    case 'copy_to_list': {
      const target = await getOwnedList(user, input.targetListId);
      if (target.id === list.id) throw Errors.badRequest('Source and target lists are the same.');
      return copyItems(list.id, target.id, input.itemIds);
    }
  }
}

async function copyItems(
  sourceListId: string,
  targetListId: string,
  itemPublicIds: string[],
): Promise<BulkActionResult> {
  const sourceItems = await db
    .select()
    .from(listItems)
    .where(and(eq(listItems.listId, sourceListId), inArray(listItems.publicId, itemPublicIds)));

  if (sourceItems.length === 0) return { affected: 0, skipped: itemPublicIds.length };

  const inserted = await db
    .insert(listItems)
    .values(
      sourceItems.map((item) => ({
        publicId: newPublicId(),
        listId: targetListId,
        gameId: item.gameId,
        // Carry the source item's privacy so copying can't accidentally widen
        // visibility of something the user had marked private.
        privacy: item.privacy,
        note: item.note,
      })),
    )
    // Games already in the target list are left alone, not duplicated.
    .onConflictDoNothing({ target: [listItems.listId, listItems.gameId] })
    .returning({ id: listItems.id });

  return { affected: inserted.length, skipped: itemPublicIds.length - inserted.length };
}

/** Used by the export route to narrow a full list down to a selection. */
export function filterToSelection(items: ListItem[], selection: string[] | undefined): ListItem[] {
  if (!selection || selection.length === 0) return items;
  const wanted = new Set(selection);
  return items.filter((i) => wanted.has(i.publicId));
}

export { toList, toListItem };
