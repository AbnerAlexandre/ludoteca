import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { ARGON2_OPTIONS } from '../lib/password.js';
import { newPublicId } from '../lib/public-id.js';
import { closeDb, db } from './index.js';
import { friendGroupMembers, friendGroups, friendships, games, listItems, lists, users } from './schema.js';

/**
 * Idempotent development seed: a couple of accounts with their default lists,
 * an accepted friendship, a group, and a handful of real Ludopedia games so
 * the UI has something to render before anyone hits the search proxy.
 *
 * Never run against production — these passwords are public.
 */
const SEED_PASSWORD = 'ludoteca-dev-2026';

/**
 * Real Ludopedia ids, verified against the live API — a made-up id here would
 * silently poison the cache and only surface as a wrong cover in the UI.
 * `detailed: false` is deliberate: the first time anyone opens one of these,
 * ensureGame() fetches the real sheet and fills in the rest.
 */
const SAMPLE_GAMES = [
  { ludopediaId: 404, name: 'Terra Mystica', originalName: 'Terra Mystica', type: 'board' as const, year: 2016, minPlayers: 2, maxPlayers: 5, playTimeMinutes: 100, minAge: 12 },
  { ludopediaId: 397, name: 'Catan: O Jogo', originalName: 'CATAN (The Settlers of Catan)', type: 'board' as const, year: 1995, minPlayers: 3, maxPlayers: 4, playTimeMinutes: 90, minAge: 10 },
  { ludopediaId: 570, name: 'Hanabi', originalName: 'Hanabi', type: 'cards' as const, year: 2010, minPlayers: 2, maxPlayers: 5, playTimeMinutes: 25, minAge: 8 },
  { ludopediaId: 73, name: 'Dominion', originalName: 'Dominion', type: 'cards' as const, year: 2008, minPlayers: 2, maxPlayers: 4, playTimeMinutes: 30, minAge: 13 },
  { ludopediaId: 14981, name: 'Azul', originalName: 'Azul', type: 'board' as const, year: 2017, minPlayers: 2, maxPlayers: 4, playTimeMinutes: 45, minAge: 8 },
  { ludopediaId: 618, name: 'Uno', originalName: 'Uno', type: 'cards' as const, year: 1971, minPlayers: 2, maxPlayers: 10, playTimeMinutes: 30, minAge: 6 },
].map((g) => ({
  ...g,
  thumbnail: `https://storage.googleapis.com/ludopedia-capas/${g.ludopediaId}_t.jpg`,
  coverUrl: `https://storage.googleapis.com/ludopedia-capas/${g.ludopediaId}_m.jpg`,
  link: `https://ludopedia.com.br/jogo/${g.ludopediaId}`,
}));

const DEFAULT_LISTS = [
  { kind: 'collection' as const, name: 'Meus Jogos' },
  { kind: 'wishlist' as const, name: 'Quero Comprar' },
  { kind: 'favorites' as const, name: 'Favoritos' },
];

async function upsertUser(login: string, email: string, displayName: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      publicId: newPublicId(),
      login,
      email,
      displayName,
      passwordHash: await argon2.hash(SEED_PASSWORD, ARGON2_OPTIONS),
      defaultGamePrivacy: 'public',
    })
    .returning();

  if (!created) throw new Error(`Failed to create user ${login}`);

  await db.insert(lists).values(
    DEFAULT_LISTS.map((l) => ({
      publicId: newPublicId(),
      ownerId: created.id,
      name: l.name,
      kind: l.kind,
      isSystem: true,
    })),
  );

  return created;
}

async function main() {
  console.log('Seeding database...');

  const gameRows = [];
  for (const g of SAMPLE_GAMES) {
    const [row] = await db
      .insert(games)
      .values({ publicId: newPublicId(), detailed: false, ...g })
      .onConflictDoUpdate({
        target: games.ludopediaId,
        set: { name: g.name, type: g.type, updatedAt: new Date() },
      })
      .returning();
    if (row) gameRows.push(row);
  }
  console.log(`  ${gameRows.length} games cached`);

  const alice = await upsertUser('alice', 'alice@example.com', 'Alice Ludens');
  const bruno = await upsertUser('bruno', 'bruno@example.com', 'Bruno Meeple');
  const carla = await upsertUser('carla', 'carla@example.com', 'Carla Dados');
  console.log('  3 users ready');

  // Give each user a slice of the catalog so group aggregation has overlap to show.
  const distribution: Array<[typeof alice, number[]]> = [
    [alice, [0, 1, 2]],
    [bruno, [1, 3]],
    [carla, [0, 4]],
  ];

  for (const [user, indexes] of distribution) {
    const collection = await db.query.lists.findFirst({
      where: (l, { and, eq: e }) => and(e(l.ownerId, user.id), e(l.kind, 'collection')),
    });
    if (!collection) continue;

    for (const i of indexes) {
      const game = gameRows[i];
      if (!game) continue;
      await db
        .insert(listItems)
        .values({
          publicId: newPublicId(),
          listId: collection.id,
          gameId: game.id,
          privacy: 'public',
        })
        .onConflictDoNothing();
    }
  }
  console.log('  collections populated');

  await db
    .insert(friendships)
    .values({
      publicId: newPublicId(),
      requesterId: alice.id,
      addresseeId: bruno.id,
      status: 'accepted',
    })
    .onConflictDoNothing();

  await db
    .insert(friendships)
    .values({
      publicId: newPublicId(),
      requesterId: carla.id,
      addresseeId: alice.id,
      status: 'pending',
    })
    .onConflictDoNothing();
  console.log('  friendships: alice↔bruno accepted, carla→alice pending');

  const existingGroup = await db.query.friendGroups.findFirst({
    where: eq(friendGroups.ownerId, alice.id),
  });
  if (!existingGroup) {
    const [group] = await db
      .insert(friendGroups)
      .values({ publicId: newPublicId(), ownerId: alice.id, name: 'Mesa de Sexta', visibility: 'closed' })
      .returning();
    if (group) {
      await db
        .insert(friendGroupMembers)
        .values([
          // Alice owns it and is an admin; Bruno is an active member; Carla has
          // an open invite to accept.
          { groupId: group.id, userId: alice.id, role: 'admin' as const, status: 'active' as const },
          { groupId: group.id, userId: bruno.id, role: 'member' as const, status: 'active' as const },
          { groupId: group.id, userId: carla.id, role: 'member' as const, status: 'invited' as const, invitedById: alice.id },
        ])
        .onConflictDoNothing();
    }
    console.log('  friend group "Mesa de Sexta" created (alice admin, bruno member, carla invited)');

    // An open group anyone can find and ask to join.
    const [openGroup] = await db
      .insert(friendGroups)
      .values({ publicId: newPublicId(), ownerId: bruno.id, name: 'Boardgamers BR', visibility: 'open' })
      .returning();
    if (openGroup) {
      await db
        .insert(friendGroupMembers)
        .values([
          { groupId: openGroup.id, userId: bruno.id, role: 'admin' as const, status: 'active' as const },
          // Carla asked to join and is waiting for approval.
          { groupId: openGroup.id, userId: carla.id, role: 'member' as const, status: 'requested' as const },
        ])
        .onConflictDoNothing();
    }
    console.log('  open group "Boardgamers BR" created (bruno admin, carla requested)');
  }

  console.log(`\nDone. Log in with alice@example.com / ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(closeDb);
