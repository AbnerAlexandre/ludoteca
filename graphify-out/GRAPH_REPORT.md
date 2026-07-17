# Graph Report - MyLudo  (2026-07-17)

## Corpus Check
- 104 files · ~51,581 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 917 nodes · 1598 edges · 42 communities (29 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cce805c0`
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
- auth.store.ts
- ListsService
- FriendsPage
- GroupDetailPage
- ApiService
- LoansPage
- seat.ts
- SearchPage
- ListsPage
- GroupsPage

## God Nodes (most connected - your core abstractions)
1. `Errors` - 42 edges
2. `ListDetailPage` - 27 edges
3. `SocialService` - 23 edges
4. `audit()` - 22 edges
5. `newPublicId()` - 22 edges
6. `AuthStore` - 22 edges
7. `ListsService` - 19 edges
8. `compilerOptions` - 17 edges
9. `db` - 16 edges
10. `sql` - 15 edges

## Surprising Connections (you probably didn't know these)
- `FastifyRequest` --references--> `UserRow`  [EXTRACTED]
  apps/api/src/types/fastify.d.ts → apps/api/src/db/schema.ts
- `auth()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/auth.ts → apps/api/src/modules/games/ludopedia.client.ts
- `listRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/lists.ts → apps/api/src/modules/games/ludopedia.client.ts
- `meRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/me.ts → apps/api/src/modules/games/ludopedia.client.ts
- `socialRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/social.ts → apps/api/src/modules/games/ludopedia.client.ts

## Import Cycles
- None detected.

## Communities (42 total, 13 thin omitted)

### Community 0 - "Build Prompt — Board & Card Game Management Web App ("Ludoteca")"
Cohesion: 0.14
Nodes (13): 1. Tech Stack (non-negotiable), 2. Configuration & Secrets, 3. Ludopedia Integration Layer, 4. Data Model (PostgreSQL / Drizzle), 5.1 Accounts & Auth, 5.2 Social, 5.3 Collections & Usage, 5. Features (+5 more)

### Community 1 - "5. Features"
Cohesion: 0.05
Nodes (95): Env, closeDb(), Database, db, sql, here, auditLog, friendGroupMembers (+87 more)

### Community 2 - "game.service.ts"
Cohesion: 0.08
Nodes (32): AppError, absoluteLink(), coverFromThumb(), fromDetail(), fromSearchResult(), inferGameType(), names(), toGame() (+24 more)

### Community 3 - "dependencies"
Cohesion: 0.06
Nodes (30): @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, dependencies, @angular/common (+22 more)

### Community 4 - "tokens.ts"
Cohesion: 0.09
Nodes (22): buildApp(), here, booleanish, envSchema, REDACT_PATHS, clearAuthCookies(), hashToken(), issueSession() (+14 more)

### Community 5 - "web"
Cohesion: 0.05
Nodes (41): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+33 more)

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, argon2, close-with-grace, drizzle-orm, fastify, @fastify/autoload, @fastify/cookie, @fastify/cors (+29 more)

### Community 7 - "auth.service.ts"
Cohesion: 0.16
Nodes (23): loginAttempts, fakeVerify(), hashPassword(), verifyPassword(), changePassword(), createDefaultLists(), DEFAULT_LISTS, deleteAccount() (+15 more)

### Community 9 - "social.schema.ts"
Cohesion: 0.07
Nodes (28): CreateFriendGroupInput, createFriendGroupSchema, CreateLoanInput, createLoanSchema, FriendGroup, FriendGroupDetail, friendGroupDetailSchema, friendGroupSchema (+20 more)

### Community 10 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, drizzle-kit, pino-pretty, tsx, @types/node, typescript, typescript, name (+17 more)

### Community 11 - "scripts"
Cohesion: 0.08
Nodes (25): devDependencies, typescript, engines, node, typescript, name, packageManager, private (+17 more)

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
Cohesion: 0.13
Nodes (8): ThemeChoice, ThemeService, Injectable, PRIVACY_COPY, AuthLayout, Component, RegisterPage, Component

### Community 27 - "api.service.ts"
Cohesion: 0.18
Nodes (16): ApiFailure, EXTENSION, GamesService, TYPE_LABEL, PRIVACY_LABEL, ViewMode, KIND_META, STATUS_LABEL (+8 more)

### Community 30 - "auth.schema.ts"
Cohesion: 0.09
Nodes (25): AuthSession, authSessionSchema, AuthStatus, authStatusSchema, LoginInput, loginInputSchema, RegisterInput, registerSchema (+17 more)

### Community 31 - "friend.service.ts"
Cohesion: 0.16
Nodes (16): COLUMNS, csvCell(), exportFilename(), item(), toCsv(), toJsonExport(), toNamesExport(), keyFor() (+8 more)

### Community 40 - "ApiService"
Cohesion: 0.36
Nodes (4): ApiService, toFailure(), toParams(), Injectable

### Community 42 - "seat.ts"
Cohesion: 0.39
Nodes (4): assignSeats(), initialsFor(), Seat, seatFor()

## Knowledge Gaps
- **338 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+333 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthStore` connect `App` to `ThemeService`, `api.service.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `auth()` connect `tokens.ts` to `5. Features`, `game.service.ts`, `App`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `ListsService` connect `ListsService` to `api.service.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _338 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build Prompt — Board & Card Game Management Web App ("Ludoteca")` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `5. Features` be split into smaller, more focused modules?**
  _Cohesion score 0.05309734513274336 - nodes in this community are weakly interconnected._
- **Should `game.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08325624421831637 - nodes in this community are weakly interconnected._