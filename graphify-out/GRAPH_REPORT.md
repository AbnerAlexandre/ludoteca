# Graph Report - MyLudo  (2026-07-17)

## Corpus Check
- 100 files · ~44,207 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 891 nodes · 1535 edges · 44 communities (35 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Build Prompt — Board & Card Game Management Web App ("Ludoteca")
- 5. Features
- game.service.ts
- dependencies
- tokens.ts
- web
- dependencies
- auth.service.ts
- user.schema.ts
- social.schema.ts
- scripts
- scripts
- Errors
- list.schema.ts
- package.json
- common.ts
- compilerOptions
- compilerOptions
- game.schema.ts
- compilerOptions
- App
- Web
- Modelo de segurança — Ludoteca
- devDependencies
- ThemeService
- api.service.ts
- SocialService
- ListDetailPage
- auth.schema.ts
- friend.service.ts
- newPublicId
- auth.store.ts
- ListsService
- group.service.ts
- FriendsPage
- GroupDetailPage
- ApiService
- LoansPage
- seat.ts
- SearchPage
- ListsPage
- errors.ts
- GroupsPage

## God Nodes (most connected - your core abstractions)
1. `Errors` - 42 edges
2. `SocialService` - 23 edges
3. `audit()` - 22 edges
4. `newPublicId()` - 22 edges
5. `AuthStore` - 22 edges
6. `ListDetailPage` - 22 edges
7. `ListsService` - 17 edges
8. `compilerOptions` - 17 edges
9. `db` - 16 edges
10. `sql` - 15 edges

## Surprising Connections (you probably didn't know these)
- `FastifyRequest` --references--> `UserRow`  [EXTRACTED]
  apps/api/src/types/fastify.d.ts → apps/api/src/db/schema.ts
- `auth()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/auth.ts → apps/api/src/modules/games/ludopedia.client.ts
- `meRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/me.ts → apps/api/src/modules/games/ludopedia.client.ts
- `listRoutes()` --indirect_call--> `item()`  [INFERRED]
  apps/api/src/routes/lists.ts → apps/api/src/modules/lists/export.test.ts
- `deriveAvailableLogin()` --calls--> `sql`  [EXTRACTED]
  apps/api/src/modules/auth/auth.service.ts → apps/api/src/db/index.ts

## Import Cycles
- None detected.

## Communities (44 total, 9 thin omitted)

### Community 0 - "Build Prompt — Board & Card Game Management Web App ("Ludoteca")"
Cohesion: 0.14
Nodes (13): 1. Tech Stack (non-negotiable), 2. Configuration & Secrets, 3. Ludopedia Integration Layer, 4. Data Model (PostgreSQL / Drizzle), 5.1 Accounts & Auth, 5.2 Social, 5.3 Collections & Usage, 5. Features (+5 more)

### Community 1 - "5. Features"
Cohesion: 0.09
Nodes (33): friendGroupMembers, FriendGroupRow, friendGroups, FriendshipRow, friendshipStatusEnum, GameRow, games, gameTypeEnum (+25 more)

### Community 2 - "game.service.ts"
Cohesion: 0.07
Nodes (40): absoluteLink(), coverFromThumb(), fromDetail(), fromSearchResult(), inferGameType(), names(), toGame(), toGameDetail() (+32 more)

### Community 3 - "dependencies"
Cohesion: 0.06
Nodes (30): @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, dependencies, @angular/common (+22 more)

### Community 4 - "tokens.ts"
Cohesion: 0.07
Nodes (17): buildApp(), here, booleanish, envSchema, AppError, REDACT_PATHS, securityPlugin(), baseCookieOptions (+9 more)

### Community 5 - "web"
Cohesion: 0.05
Nodes (41): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+33 more)

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, argon2, close-with-grace, drizzle-orm, fastify, @fastify/autoload, @fastify/cookie, @fastify/cors (+29 more)

### Community 7 - "auth.service.ts"
Cohesion: 0.16
Nodes (23): loginAttempts, fakeVerify(), hashPassword(), verifyPassword(), changePassword(), createDefaultLists(), DEFAULT_LISTS, deleteAccount() (+15 more)

### Community 8 - "user.schema.ts"
Cohesion: 0.13
Nodes (14): privacySchema, trimmed(), ChangePasswordInput, changePasswordSchema, DeleteAccountInput, deleteAccountSchema, Me, PublicUser (+6 more)

### Community 9 - "social.schema.ts"
Cohesion: 0.07
Nodes (27): CreateFriendGroupInput, createFriendGroupSchema, CreateLoanInput, createLoanSchema, FriendGroup, FriendGroupDetail, friendGroupDetailSchema, friendGroupSchema (+19 more)

### Community 10 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, drizzle-kit, pino-pretty, tsx, @types/node, typescript, typescript, name (+17 more)

### Community 11 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, typescript, engines, node, typescript, name, packageManager, private (+17 more)

### Community 12 - "Errors"
Cohesion: 0.24
Nodes (18): Errors, addItem(), allListItems(), bulkAction(), copyItems(), createList(), deleteList(), getOwnedList() (+10 more)

### Community 13 - "list.schema.ts"
Cohesion: 0.08
Nodes (23): listKindSchema, AddListItemInput, addListItemSchema, BulkActionInput, BulkActionResult, bulkActionResultSchema, bulkActionSchema, bulkTargets (+15 more)

### Community 14 - "package.json"
Cohesion: 0.08
Nodes (24): default, types, default, dependencies, zod, devDependencies, typescript, exports (+16 more)

### Community 15 - "common.ts"
Cohesion: 0.10
Nodes (20): ApiError, apiErrorSchema, ErrorCode, errorCodeSchema, FriendshipStatus, friendshipStatusSchema, GameType, ListItemSort (+12 more)

### Community 16 - "compilerOptions"
Cohesion: 0.11
Nodes (18): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+10 more)

### Community 17 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, module, moduleResolution, outDir, rootDir, types, exclude, extends (+6 more)

### Community 18 - "game.schema.ts"
Cohesion: 0.15
Nodes (12): gameTypeSchema, pageOf(), paginationSchema, publicIdSchema, Game, GameDetail, gameDetailSchema, gameSchema (+4 more)

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declarationMap, module, moduleResolution, outDir, rootDir, extends, include (+2 more)

### Community 21 - "App"
Cohesion: 0.11
Nodes (14): App, appConfig, routes, Component, authGuard(), guestGuard(), AuthStore, Injectable (+6 more)

### Community 22 - "Web"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, Running end-to-end tests, Running unit tests, Web

### Community 24 - "Modelo de segurança — Ludoteca"
Cohesion: 0.06
Nodes (33): Convenções que não dá para inferir do código, Grafo, Login de exemplo, Ludoteca — notas para o agente, API, API em container (opcional), Arquitetura, Comandos (+25 more)

### Community 25 - "devDependencies"
Cohesion: 0.07
Nodes (27): @angular/build, @angular/cli, @angular/compiler-cli, devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, @fontsource-variable/bricolage-grotesque (+19 more)

### Community 26 - "ThemeService"
Cohesion: 0.11
Nodes (9): ThemeChoice, ThemeService, Injectable, AccountPage, PRIVACY_COPY, Component, AppShell, NavItem (+1 more)

### Community 27 - "api.service.ts"
Cohesion: 0.22
Nodes (10): ApiFailure, GamesService, PRIVACY_LABEL, ViewMode, KIND_META, STATUS_LABEL, EmptyState, SeatToken (+2 more)

### Community 30 - "auth.schema.ts"
Cohesion: 0.13
Nodes (14): AuthSession, authSessionSchema, AuthStatus, authStatusSchema, LoginInput, loginInputSchema, RegisterInput, registerSchema (+6 more)

### Community 31 - "friend.service.ts"
Cohesion: 0.22
Nodes (13): friendships, acceptRequest(), friendsOf(), getUserByPublicId(), sendRequest(), unfriendUser(), acceptedFriendIds(), areFriends() (+5 more)

### Community 32 - "newPublicId"
Cohesion: 0.19
Nodes (9): Env, closeDb(), Database, db, here, auditLog, publicId(), AuditEvent (+1 more)

### Community 33 - "auth.store.ts"
Cohesion: 0.16
Nodes (6): AuthLayout, Component, LoginPage, Component, RegisterPage, Component

### Community 36 - "group.service.ts"
Cohesion: 0.22
Nodes (18): sql, cacheSearchRows(), pendingRequests(), searchUsers(), relationsFor(), addMembers(), assertAllAreFriends(), createGroup() (+10 more)

### Community 40 - "ApiService"
Cohesion: 0.36
Nodes (4): ApiService, toFailure(), toParams(), Injectable

### Community 42 - "seat.ts"
Cohesion: 0.39
Nodes (4): assignSeats(), initialsFor(), Seat, seatFor()

### Community 45 - "errors.ts"
Cohesion: 0.21
Nodes (14): audit(), STATUS_BY_CODE, clearAuthCookies(), hashToken(), issueSession(), newRawToken(), persistRefreshToken(), revokeSession() (+6 more)

## Knowledge Gaps
- **335 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+330 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthStore` connect `App` to `auth.store.ts`, `ThemeService`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `auth()` connect `errors.ts` to `game.service.ts`, `Errors`, `App`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `SocialService` connect `SocialService` to `game.service.ts`, `api.service.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `AuthStore` (e.g. with `authGuard()` and `guestGuard()`) actually correct?**
  _`AuthStore` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _335 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build Prompt — Board & Card Game Management Web App ("Ludoteca")` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `5. Features` be split into smaller, more focused modules?**
  _Cohesion score 0.09309309309309309 - nodes in this community are weakly interconnected._