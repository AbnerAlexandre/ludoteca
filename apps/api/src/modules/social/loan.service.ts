import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyRequest } from 'fastify';
import type { CreateLoanInput, Loan, LoansQuery, Page } from '@ludoteca/shared';
import { db } from '../../db/index.js';
import { games, listItems, lists, loans, users, type GameRow, type LoanRow, type UserRow } from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { newPublicId } from '../../lib/public-id.js';
import { toGame } from '../games/game.mapper.js';
import { toPublicUser } from '../users/user.mapper.js';
import { areFriends } from './friendship.service.js';
import { getUserByPublicId } from './friend.service.js';

function toLoan(row: LoanRow, game: GameRow, lender: UserRow, borrower: UserRow, viewerId: string): Loan {
  return {
    publicId: row.publicId,
    game: toGame(game),
    lender: toPublicUser(lender),
    borrower: toPublicUser(borrower),
    status: row.status,
    role: row.lenderId === viewerId ? 'lending' : 'borrowing',
    note: row.note,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
  };
}

/** Owning a game means having it in your collection list, not merely wanting it. */
async function ownsGame(userId: string, gameId: string): Promise<boolean> {
  const row = await db
    .select({ id: listItems.id })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .where(and(eq(lists.ownerId, userId), eq(lists.kind, 'collection'), eq(listItems.gameId, gameId)))
    .limit(1);
  return row.length > 0;
}

/**
 * Creates a loan from either direction (spec §5.2): the owner lends a game out,
 * or a friend asks to borrow one. Both produce the same row; `intent` decides
 * who is lender and who is borrower.
 *
 * Loans are friends-only. Lending is a real-world handover of a physical
 * object, so it shouldn't be arrangeable with an arbitrary stranger's id.
 */
export async function createLoan(
  request: FastifyRequest,
  viewer: UserRow,
  input: CreateLoanInput,
): Promise<Loan> {
  const counterpart = await getUserByPublicId(input.counterpartId);
  if (counterpart.id === viewer.id) throw Errors.badRequest('You cannot lend a game to yourself.');
  if (!(await areFriends(viewer.id, counterpart.id))) {
    throw Errors.badRequest('You can only lend games to friends.');
  }

  const game = await db.query.games.findFirst({ where: eq(games.publicId, input.gameId) });
  if (!game) throw Errors.notFound('Game');

  const lenderId = input.intent === 'lend' ? viewer.id : counterpart.id;
  const borrowerId = input.intent === 'lend' ? counterpart.id : viewer.id;

  // The lender has to actually own the copy. Without this, anyone could invent
  // a loan record against someone else's name.
  if (!(await ownsGame(lenderId, game.id))) {
    throw Errors.badRequest(
      input.intent === 'lend'
        ? 'This game is not in your collection.'
        : 'That friend does not have this game in their collection.',
    );
  }

  const open = await db.query.loans.findFirst({
    where: and(eq(loans.gameId, game.id), eq(loans.lenderId, lenderId), sql`${loans.status} <> 'returned'`),
  });
  if (open) throw Errors.conflict('That copy is already out on loan.');

  const [row] = await db
    .insert(loans)
    .values({
      publicId: newPublicId(),
      gameId: game.id,
      lenderId,
      borrowerId,
      // Lending is the owner's call, so it starts active. A borrow request needs
      // the owner's approval first.
      status: input.intent === 'lend' ? 'active' : 'requested',
      note: input.note ?? null,
      startedAt: input.intent === 'lend' ? new Date() : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning();
  if (!row) throw Errors.conflict('Could not create the loan.');

  const lender = lenderId === viewer.id ? viewer : counterpart;
  const borrower = borrowerId === viewer.id ? viewer : counterpart;
  await audit(request, 'loan.created', { userId: viewer.id, metadata: { intent: input.intent } });
  return toLoan(row, game, lender, borrower, viewer.id);
}

export async function loansFor(viewer: UserRow, query: LoansQuery): Promise<Page<Loan>> {
  const clauses: SQL[] = [];
  const roleClause =
    query.role === 'lending'
      ? eq(loans.lenderId, viewer.id)
      : query.role === 'borrowing'
        ? eq(loans.borrowerId, viewer.id)
        : or(eq(loans.lenderId, viewer.id), eq(loans.borrowerId, viewer.id))!;
  clauses.push(roleClause);
  if (query.status !== 'all') clauses.push(eq(loans.status, query.status));
  const where = and(...clauses)!;

  // `users` is joined twice, so each side needs its own alias — otherwise the
  // two joins collapse onto the same table reference.
  const lender = alias(users, 'lender');
  const borrower = alias(users, 'borrower');

  const rows = await db
    .select({ loan: loans, game: games, lender, borrower })
    .from(loans)
    .innerJoin(games, eq(games.id, loans.gameId))
    .innerJoin(lender, eq(lender.id, loans.lenderId))
    .innerJoin(borrower, eq(borrower.id, loans.borrowerId))
    .where(where)
    .orderBy(desc(loans.requestedAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const [totalRow] = await db.select({ value: sql<number>`count(*)::int` }).from(loans).where(where);
  const total = totalRow?.value ?? 0;

  return {
    items: rows.map((r) => toLoan(r.loan, r.game, r.lender, r.borrower, viewer.id)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/**
 * Status transitions, with who may make each one:
 *   requested -> active    : lender only (approving a borrow request)
 *   requested -> returned  : either party (declining / withdrawing)
 *   active    -> returned  : either party (the game came back)
 * Anything else is rejected — including re-returning an already-closed loan.
 */
export async function updateLoanStatus(
  request: FastifyRequest,
  viewer: UserRow,
  loanPublicId: string,
  next: 'active' | 'returned',
): Promise<Loan> {
  const row = await db.query.loans.findFirst({ where: eq(loans.publicId, loanPublicId) });
  if (!row || (row.lenderId !== viewer.id && row.borrowerId !== viewer.id)) {
    throw Errors.notFound('Loan');
  }

  if (next === 'active') {
    if (row.status !== 'requested') throw Errors.conflict('This loan is not awaiting approval.');
    // Only the owner can hand their game over.
    if (row.lenderId !== viewer.id) throw Errors.forbidden();
  } else if (row.status === 'returned') {
    throw Errors.conflict('This loan is already closed.');
  }

  const [updated] = await db
    .update(loans)
    .set({
      status: next,
      startedAt: next === 'active' ? new Date() : row.startedAt,
      returnedAt: next === 'returned' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, row.id))
    .returning();
  if (!updated) throw Errors.notFound('Loan');

  const game = await db.query.games.findFirst({ where: eq(games.id, updated.gameId) });
  const lenderRow = await db.query.users.findFirst({ where: eq(users.id, updated.lenderId) });
  const borrowerRow = await db.query.users.findFirst({ where: eq(users.id, updated.borrowerId) });
  if (!game || !lenderRow || !borrowerRow) throw Errors.notFound('Loan');

  await audit(request, 'loan.status_changed', {
    userId: viewer.id,
    metadata: { from: row.status, to: next },
  });
  return toLoan(updated, game, lenderRow, borrowerRow, viewer.id);
}
