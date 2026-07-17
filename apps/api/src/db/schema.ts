import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// --- Enums ------------------------------------------------------------------
// Mirror the zod enums in @ludoteca/shared. The two are kept in step by
// `assertSchemaParity` in db/parity.ts, which fails the test run if they drift.

export const privacyEnum = pgEnum('privacy', ['friends', 'public', 'nobody']);
export const gameTypeEnum = pgEnum('game_type', ['board', 'cards', 'expansion', 'rpg', 'other']);
export const listKindEnum = pgEnum('list_kind', ['collection', 'wishlist', 'favorites', 'custom']);
export const friendshipStatusEnum = pgEnum('friendship_status', ['pending', 'accepted']);
export const loanStatusEnum = pgEnum('loan_status', ['requested', 'active', 'returned']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Opaque external id. Every table that is addressable over HTTP carries one. */
const publicId = () => varchar('public_id', { length: 12 }).notNull();

// --- Users ------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    login: varchar('login', { length: 32 }).notNull(),
    email: varchar('email', { length: 254 }).notNull(),
    /** Null for Google-only accounts. */
    passwordHash: text('password_hash'),
    displayName: varchar('display_name', { length: 60 }),
    avatarUrl: text('avatar_url'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    googleConnected: boolean('google_connected').notNull().default(false),
    googleId: text('google_id'),
    defaultGamePrivacy: privacyEnum('default_game_privacy').notNull().default('public'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_public_id_uq').on(t.publicId),
    // Case-insensitive uniqueness: "Alice" and "alice" must not be two accounts.
    uniqueIndex('users_login_lower_uq').on(sql`lower(${t.login})`),
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    uniqueIndex('users_google_id_uq').on(t.googleId),
    // A Google-only account has no password; either way one of them must exist.
    check(
      'users_has_credential',
      sql`${t.passwordHash} is not null or ${t.googleId} is not null`,
    ),
  ],
);

/**
 * Refresh tokens are stored hashed, grouped into a `familyId`. Rotation issues
 * a new token in the same family; presenting an already-rotated token means it
 * leaked, so the whole family is revoked. See SECURITY.md ("session model").
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedById: uuid('replaced_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash),
    index('refresh_tokens_user_idx').on(t.userId),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

/**
 * One row per failed login, keyed by a hash of the identifier (never the raw
 * login/email) plus the source IP. Feeds progressive delay and lockout.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifierHash: text('identifier_hash').notNull(),
    ip: varchar('ip', { length: 45 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('login_attempts_identifier_idx').on(t.identifierHash, t.createdAt),
    index('login_attempts_ip_idx').on(t.ip, t.createdAt),
  ],
);

/** Security-relevant events. Deliberately holds no payloads and no secrets. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nullable and ON DELETE SET NULL: deleting an account must not erase the
    // trail that the deletion happened.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    event: varchar('event', { length: 64 }).notNull(),
    requestId: varchar('request_id', { length: 64 }),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 256 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_user_idx').on(t.userId, t.createdAt), index('audit_log_event_idx').on(t.event, t.createdAt)],
);

// --- Social -----------------------------------------------------------------

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull().default('pending'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('friendships_public_id_uq').on(t.publicId),
    uniqueIndex('friendships_pair_uq').on(t.requesterId, t.addresseeId),
    // The pair index above is directional, so (a→b) and (b→a) could both exist.
    // This one keys on the sorted pair, making the relationship unique either way.
    uniqueIndex('friendships_unordered_pair_uq').on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    check('friendships_no_self', sql`${t.requesterId} <> ${t.addresseeId}`),
    index('friendships_addressee_idx').on(t.addresseeId, t.status),
  ],
);

export const friendGroups = pgTable(
  'friend_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('friend_groups_public_id_uq').on(t.publicId),
    index('friend_groups_owner_idx').on(t.ownerId),
  ],
);

export const friendGroupMembers = pgTable(
  'friend_group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => friendGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('friend_group_members_user_idx').on(t.userId),
  ],
);

// --- Catalog ----------------------------------------------------------------

/**
 * Local cache of the Ludopedia catalog. `fetchedAt` drives the TTL and
 * `detailed` records whether we have the full sheet or just the thin row that
 * /jogos search returns (id, name, thumb, link — no year, no type).
 */
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    ludopediaId: integer('ludopedia_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    originalName: varchar('original_name', { length: 200 }),
    type: gameTypeEnum('type').notNull().default('other'),
    thumbnail: text('thumbnail'),
    coverUrl: text('cover_url'),
    link: text('link'),
    year: integer('year'),
    minPlayers: integer('min_players'),
    maxPlayers: integer('max_players'),
    playTimeMinutes: integer('play_time_minutes'),
    minAge: integer('min_age'),
    mechanics: jsonb('mechanics').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    categories: jsonb('categories').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    themes: jsonb('themes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    designers: jsonb('designers').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    artists: jsonb('artists').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    detailed: boolean('detailed').notNull().default(false),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('games_public_id_uq').on(t.publicId),
    uniqueIndex('games_ludopedia_id_uq').on(t.ludopediaId),
    // Powers the cache-backed search fallback when Ludopedia is unreachable.
    index('games_name_lower_idx').on(sql`lower(${t.name})`),
    index('games_type_idx').on(t.type),
  ],
);

// --- Lists ------------------------------------------------------------------

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    kind: listKindEnum('kind').notNull().default('custom'),
    /** System lists are seeded per user and cannot be renamed or deleted. */
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('lists_public_id_uq').on(t.publicId),
    index('lists_owner_idx').on(t.ownerId),
    // At most one collection/wishlist/favorites per user; custom lists unbounded.
    uniqueIndex('lists_owner_system_kind_uq')
      .on(t.ownerId, t.kind)
      .where(sql`${t.kind} <> 'custom'`),
  ],
);

export const listItems = pgTable(
  'list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** Seeded from the owner's default_game_privacy, overridable per item. */
    privacy: privacyEnum('privacy').notNull().default('public'),
    note: varchar('note', { length: 500 }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('list_items_public_id_uq').on(t.publicId),
    uniqueIndex('list_items_list_game_uq').on(t.listId, t.gameId),
    index('list_items_list_added_idx').on(t.listId, t.addedAt),
    index('list_items_game_idx').on(t.gameId),
  ],
);

// --- Loans ------------------------------------------------------------------

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: publicId(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    lenderId: uuid('lender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    borrowerId: uuid('borrower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: loanStatusEnum('status').notNull().default('requested'),
    note: varchar('note', { length: 500 }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('loans_public_id_uq').on(t.publicId),
    check('loans_no_self', sql`${t.lenderId} <> ${t.borrowerId}`),
    // A copy can only be out once: one open loan per game at a time.
    uniqueIndex('loans_one_open_per_game_uq')
      .on(t.gameId, t.lenderId)
      .where(sql`status <> 'returned'`),
    index('loans_lender_idx').on(t.lenderId, t.status),
    index('loans_borrower_idx').on(t.borrowerId, t.status),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type ListRow = typeof lists.$inferSelect;
export type ListItemRow = typeof listItems.$inferSelect;
export type LoanRow = typeof loans.$inferSelect;
export type FriendshipRow = typeof friendships.$inferSelect;
export type FriendGroupRow = typeof friendGroups.$inferSelect;
