# Graph Report - MyLudo  (2026-07-18)

## Corpus Check
- 111 files · ~57,318 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 981 nodes · 1696 edges · 47 communities (37 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f50fc8dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- AppShell
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
- game.service.ts
- auth.store.ts
- ListsService
- deploy
- vercel.json
- FriendsPage
- GroupDetailPage
- newPublicId
- ApiService
- LoansPage
- seat.ts
- SearchPage
- ListsPage
- GroupsPage

## God Nodes (most connected - your core abstractions)
1. `Errors` - 42 edges
2. `ListDetailPage` - 27 edges
3. `AuthStore` - 24 edges
4. `SocialService` - 23 edges
5. `audit()` - 22 edges
6. `newPublicId()` - 22 edges
7. `ListsService` - 20 edges
8. `sql` - 17 edges
9. `scripts` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `FastifyRequest` --references--> `UserRow`  [EXTRACTED]
  apps/api/src/types/fastify.d.ts → apps/api/src/db/schema.ts
- `auth()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/auth.ts → apps/api/src/modules/games/ludopedia.client.ts
- `gameRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/games.ts → apps/api/src/modules/games/ludopedia.client.ts
- `meRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/me.ts → apps/api/src/modules/games/ludopedia.client.ts
- `listRoutes()` --indirect_call--> `item()`  [INFERRED]
  apps/api/src/routes/lists.ts → apps/api/src/modules/lists/export.test.ts

## Import Cycles
- None detected.

## Communities (47 total, 10 thin omitted)

### Community 0 - "Build Prompt — Board & Card Game Management Web App ("Ludoteca")"
Cohesion: 0.14
Nodes (13): 1. Tech Stack (non-negotiable), 2. Configuration & Secrets, 3. Ludopedia Integration Layer, 4. Data Model (PostgreSQL / Drizzle), 5.1 Accounts & Auth, 5.2 Social, 5.3 Collections & Usage, 5. Features (+5 more)

### Community 1 - "5. Features"
Cohesion: 0.10
Nodes (29): auditLog, friendGroupMembers, friendGroups, FriendshipRow, friendshipStatusEnum, games, gameTypeEnum, ListItemRow (+21 more)

### Community 2 - "game.service.ts"
Cohesion: 0.06
Nodes (30): AppError, breaker, CircuitBreaker, jogoResumoSchema, jogoSchema, Logger, ludopedia, LudopediaJogo (+22 more)

### Community 3 - "dependencies"
Cohesion: 0.06
Nodes (32): @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, dependencies, @angular/common (+24 more)

### Community 4 - "tokens.ts"
Cohesion: 0.09
Nodes (25): buildApp(), here, booleanish, Env, envSchema, refreshTokens, REDACT_PATHS, clearAuthCookies() (+17 more)

### Community 5 - "web"
Cohesion: 0.05
Nodes (42): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+34 more)

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, argon2, close-with-grace, drizzle-orm, fastify, @fastify/autoload, @fastify/cookie, @fastify/cors (+29 more)

### Community 7 - "auth.service.ts"
Cohesion: 0.14
Nodes (26): sql, loginAttempts, fakeVerify(), hashPassword(), verifyPassword(), changePassword(), createDefaultLists(), DEFAULT_LISTS (+18 more)

### Community 8 - "user.schema.ts"
Cohesion: 0.17
Nodes (24): FriendGroupRow, friendships, STATUS_BY_CODE, getViewableList(), friendsOf(), pendingRequests(), searchUsers(), acceptedFriendIds() (+16 more)

### Community 9 - "social.schema.ts"
Cohesion: 0.07
Nodes (28): CreateFriendGroupInput, createFriendGroupSchema, CreateLoanInput, createLoanSchema, FriendGroup, FriendGroupDetail, friendGroupDetailSchema, friendGroupSchema (+20 more)

### Community 10 - "scripts"
Cohesion: 0.07
Nodes (29): devDependencies, drizzle-kit, pino-pretty, tsx, @types/node, typescript, typescript, name (+21 more)

### Community 11 - "scripts"
Cohesion: 0.07
Nodes (27): devDependencies, typescript, engines, node, typescript, name, packageManager, private (+19 more)

### Community 13 - "list.schema.ts"
Cohesion: 0.08
Nodes (25): sortDirectionSchema, AddListItemInput, addListItemSchema, BulkActionInput, BulkActionResult, bulkActionResultSchema, bulkActionSchema, bulkTargets (+17 more)

### Community 14 - "package.json"
Cohesion: 0.08
Nodes (24): default, types, default, dependencies, zod, devDependencies, typescript, exports (+16 more)

### Community 15 - "common.ts"
Cohesion: 0.09
Nodes (22): ApiError, apiErrorSchema, ErrorCode, errorCodeSchema, FriendshipStatus, friendshipStatusSchema, GameType, ListItemSort (+14 more)

### Community 16 - "compilerOptions"
Cohesion: 0.11
Nodes (18): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+10 more)

### Community 17 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, module, moduleResolution, outDir, rootDir, types, exclude, extends (+7 more)

### Community 18 - "game.schema.ts"
Cohesion: 0.15
Nodes (12): gameTypeSchema, pageOf(), paginationSchema, publicIdSchema, Game, GameDetail, gameDetailSchema, gameSchema (+4 more)

### Community 19 - "AppShell"
Cohesion: 0.33
Nodes (7): Feature, Icon, IconName, Component, AppShell, NavItem, Component

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declarationMap, module, moduleResolution, outDir, rootDir, extends, include (+2 more)

### Community 21 - "App"
Cohesion: 0.05
Nodes (26): App, appConfig, routes, Component, authGuard(), guestGuard(), AuthStore, Injectable (+18 more)

### Community 22 - "Web"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, Running end-to-end tests, Running unit tests, Web

### Community 24 - "Modelo de segurança — Ludoteca"
Cohesion: 0.05
Nodes (40): Convenções que não dá para inferir do código, Grafo, Login de exemplo, Ludoteca — notas para o agente, 1. Railway — API + Postgres, 2. Vercel — Web, Alternativa: tudo no Railway, Checklist pós-deploy (+32 more)

### Community 25 - "devDependencies"
Cohesion: 0.07
Nodes (27): @angular/build, @angular/cli, @angular/compiler-cli, devDependencies, @angular/build, @angular/cli, @angular/compiler-cli, @fontsource-variable/bricolage-grotesque (+19 more)

### Community 26 - "ThemeService"
Cohesion: 0.18
Nodes (25): audit(), Errors, addItem(), allListItems(), bulkAction(), createList(), deleteList(), getOwnedList() (+17 more)

### Community 27 - "api.service.ts"
Cohesion: 0.20
Nodes (12): ApiFailure, EXTENSION, GamesService, TYPE_LABEL, PRIVACY_LABEL, ViewMode, KIND_META, STATUS_LABEL (+4 more)

### Community 30 - "auth.schema.ts"
Cohesion: 0.09
Nodes (25): AuthSession, authSessionSchema, AuthStatus, authStatusSchema, LoginInput, loginInputSchema, RegisterInput, registerSchema (+17 more)

### Community 31 - "friend.service.ts"
Cohesion: 0.14
Nodes (12): BY_ID, coverUrl(), FEATURED_GAMES, featuredById(), FeaturedGame, FeaturedType, ludopediaLink(), GameShowcasePage (+4 more)

### Community 32 - "game.service.ts"
Cohesion: 0.23
Nodes (18): GameRow, absoluteLink(), coverFromThumb(), fromDetail(), fromSearchResult(), inferGameType(), names(), toGame() (+10 more)

### Community 33 - "auth.store.ts"
Cohesion: 0.27
Nodes (7): closeDb(), Database, db, here, main(), waitForDatabase(), AuditEvent

### Community 35 - "deploy"
Cohesion: 0.18
Nodes (10): build, builder, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyMaxRetries, restartPolicyType (+2 more)

### Community 36 - "vercel.json"
Cohesion: 0.25
Nodes (7): buildCommand, framework, headers, installCommand, outputDirectory, rewrites, $schema

### Community 39 - "newPublicId"
Cohesion: 0.38
Nodes (6): main(), upsertUser(), generate, newPublicId(), cacheSearchRows(), copyItems()

### Community 40 - "ApiService"
Cohesion: 0.36
Nodes (4): ApiService, toFailure(), toParams(), Injectable

### Community 42 - "seat.ts"
Cohesion: 0.39
Nodes (4): assignSeats(), initialsFor(), Seat, seatFor()

## Knowledge Gaps
- **371 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+366 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthStore` connect `App` to `AppShell`, `friend.service.ts`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `auth()` connect `tokens.ts` to `ThemeService`, `game.service.ts`, `App`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `ListsService` connect `ListsService` to `api.service.ts`, `friend.service.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `AuthStore` (e.g. with `authGuard()` and `guestGuard()`) actually correct?**
  _`AuthStore` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _371 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build Prompt — Board & Card Game Management Web App ("Ludoteca")` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `5. Features` be split into smaller, more focused modules?**
  _Cohesion score 0.0962566844919786 - nodes in this community are weakly interconnected._