# Graph Report - MyLudo  (2026-10-10)

## Corpus Check
- 121 files · ~84,912 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1133 nodes · 2055 edges · 62 communities (41 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d7b7bd49`
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
- user.schema.ts
- scripts
- AccountPage
- UserRow
- errors.ts
- GroupDirectoryPage
- ProfilePage
- package.json
- RegisterPage
- @angular/compiler-cli
- @fontsource-variable/jetbrains-mono
- @fontsource-variable/plus-jakarta-sans
- postcss
- feedback.service.ts
- @fontsource-variable/gabarito

## God Nodes (most connected - your core abstractions)
1. `Errors` - 52 edges
2. `SocialService` - 34 edges
3. `ListDetailPage` - 34 edges
4. `audit()` - 26 edges
5. `AuthStore` - 26 edges
6. `GroupDetailPage` - 24 edges
7. `newPublicId()` - 22 edges
8. `FeedbackService` - 20 edges
9. `ListsService` - 20 edges
10. `Icon` - 19 edges

## Surprising Connections (you probably didn't know these)
- `auth()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/auth.ts → apps/api/src/modules/games/ludopedia.client.ts
- `listRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/lists.ts → apps/api/src/modules/games/ludopedia.client.ts
- `meRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/me.ts → apps/api/src/modules/games/ludopedia.client.ts
- `socialRoutes()` --indirect_call--> `request()`  [INFERRED]
  apps/api/src/routes/social.ts → apps/api/src/modules/games/ludopedia.client.ts
- `listRoutes()` --indirect_call--> `item()`  [INFERRED]
  apps/api/src/routes/lists.ts → apps/api/src/modules/lists/export.test.ts

## Import Cycles
- None detected.

## Communities (62 total, 21 thin omitted)

### Community 0 - "Build Prompt — Board & Card Game Management Web App ("Ludoteca")"
Cohesion: 0.14
Nodes (13): 1. Tech Stack (non-negotiable), 2. Configuration & Secrets, 3. Ludopedia Integration Layer, 4. Data Model (PostgreSQL / Drizzle), 5.1 Accounts & Auth, 5.2 Social, 5.3 Collections & Usage, 5. Features (+5 more)

### Community 1 - "5. Features"
Cohesion: 0.08
Nodes (28): auditLog, friendGroupMembers, FriendGroupRow, FriendshipRow, friendshipStatusEnum, gameTypeEnum, groupMemberStatusEnum, groupRoleEnum (+20 more)

### Community 2 - "game.service.ts"
Cohesion: 0.19
Nodes (8): ListSnapshot, PRIVACY, ViewMode, IconName, Menu, Component, AttentionKey, NavItem

### Community 3 - "dependencies"
Cohesion: 0.11
Nodes (19): @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, dependencies, @angular/common (+11 more)

### Community 4 - "tokens.ts"
Cohesion: 0.07
Nodes (35): buildApp(), here, booleanish, Env, envSchema, REDACT_PATHS, clearAuthCookies(), hashToken() (+27 more)

### Community 5 - "web"
Cohesion: 0.05
Nodes (42): build, serve, test, builder, configurations, defaultConfiguration, options, cli (+34 more)

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, argon2, close-with-grace, drizzle-orm, fastify, @fastify/autoload, @fastify/cookie, @fastify/cors (+29 more)

### Community 7 - "auth.service.ts"
Cohesion: 0.18
Nodes (21): loginAttempts, audit(), fakeVerify(), hashPassword(), verifyPassword(), changePassword(), createDefaultLists(), DEFAULT_LISTS (+13 more)

### Community 8 - "user.schema.ts"
Cohesion: 0.15
Nodes (27): friendships, listItems, lists, loans, getViewableList(), acceptRequest(), friendsOf(), getUserByPublicId() (+19 more)

### Community 9 - "social.schema.ts"
Cohesion: 0.05
Nodes (38): CreateFriendGroupInput, createFriendGroupSchema, CreateLoanInput, createLoanSchema, FriendGroup, FriendGroupDetail, friendGroupDetailSchema, friendGroupSchema (+30 more)

### Community 10 - "scripts"
Cohesion: 0.07
Nodes (29): devDependencies, drizzle-kit, pino-pretty, tsx, @types/node, typescript, typescript, name (+21 more)

### Community 11 - "scripts"
Cohesion: 0.07
Nodes (27): devDependencies, typescript, engines, node, typescript, name, packageManager, private (+19 more)

### Community 13 - "list.schema.ts"
Cohesion: 0.07
Nodes (27): gameTypeFilterSchema, listItemSortSchema, sortDirectionSchema, AddListItemInput, addListItemSchema, BulkActionInput, BulkActionResult, bulkActionResultSchema (+19 more)

### Community 14 - "package.json"
Cohesion: 0.08
Nodes (24): default, types, default, dependencies, zod, devDependencies, typescript, exports (+16 more)

### Community 15 - "common.ts"
Cohesion: 0.07
Nodes (26): ApiError, apiErrorSchema, ErrorCode, errorCodeSchema, FriendshipStatus, friendshipStatusSchema, GAME_TYPE_LABELS, GameType (+18 more)

### Community 16 - "compilerOptions"
Cohesion: 0.11
Nodes (18): ES2023, compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+10 more)

### Community 17 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, module, moduleResolution, outDir, rootDir, types, exclude, extends (+7 more)

### Community 18 - "game.schema.ts"
Cohesion: 0.15
Nodes (12): gameTypeSchema, pageOf(), paginationSchema, publicIdSchema, Game, GameDetail, gameDetailSchema, gameSchema (+4 more)

### Community 20 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, declarationMap, module, moduleResolution, outDir, rootDir, extends, include (+2 more)

### Community 21 - "App"
Cohesion: 0.09
Nodes (16): App, appConfig, routes, Component, authGuard(), guestGuard(), AuthStore, Injectable (+8 more)

### Community 22 - "Web"
Cohesion: 0.25
Nodes (7): Additional Resources, Building, Code scaffolding, Development server, Running end-to-end tests, Running unit tests, Web

### Community 24 - "Modelo de segurança — Ludoteca"
Cohesion: 0.05
Nodes (40): Convenções que não dá para inferir do código, Grafo, Login de exemplo, Ludoteca — notas para o agente, 1. Railway — API + Postgres, 2. Vercel — Web, Alternativa: tudo no Railway, Checklist pós-deploy (+32 more)

### Community 25 - "devDependencies"
Cohesion: 0.11
Nodes (19): @angular/build, @angular/cli, devDependencies, @angular/build, @angular/cli, @fontsource-variable/figtree, jsdom, prettier (+11 more)

### Community 26 - "ThemeService"
Cohesion: 0.21
Nodes (18): addItem(), allListItems(), bulkAction(), copyItems(), createList(), deleteList(), getOwnedList(), itemFilters() (+10 more)

### Community 27 - "api.service.ts"
Cohesion: 0.22
Nodes (13): KIND_META, STATUS, KIND_META, Icon, Component, Sheet, Component, Cover (+5 more)

### Community 30 - "auth.schema.ts"
Cohesion: 0.13
Nodes (14): AuthSession, authSessionSchema, AuthStatus, authStatusSchema, LoginInput, loginInputSchema, RegisterInput, registerSchema (+6 more)

### Community 31 - "friend.service.ts"
Cohesion: 0.07
Nodes (20): ThemeChoice, ThemeService, Injectable, AccountPage, Component, AuthLayout, Component, BY_ID (+12 more)

### Community 32 - "game.service.ts"
Cohesion: 0.09
Nodes (32): GameRow, games, absoluteLink(), coverFromThumb(), fromDetail(), fromSearchResult(), inferGameType(), names() (+24 more)

### Community 33 - "auth.store.ts"
Cohesion: 0.14
Nodes (20): closeDb(), Database, db, sql, here, main(), waitForDatabase(), friendGroups (+12 more)

### Community 35 - "deploy"
Cohesion: 0.18
Nodes (10): build, builder, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyMaxRetries, restartPolicyType (+2 more)

### Community 36 - "vercel.json"
Cohesion: 0.25
Nodes (7): buildCommand, framework, headers, installCommand, outputDirectory, rewrites, $schema

### Community 39 - "newPublicId"
Cohesion: 0.25
Nodes (24): Errors, acceptInvite(), activeCounts(), approveRequest(), createGroup(), deleteGroup(), getGroup(), getManagedGroup() (+16 more)

### Community 40 - "ApiService"
Cohesion: 0.17
Nodes (8): ApiFailure, ApiService, toFailure(), toParams(), Injectable, EXTENSION, PRIVACY_COPY, TYPE_LABEL

### Community 42 - "seat.ts"
Cohesion: 0.31
Nodes (5): assignSeats(), initialsFor(), Seat, seatFor(), Tab

### Community 47 - "user.schema.ts"
Cohesion: 0.10
Nodes (19): listKindSchema, privacySchema, trimmed(), ChangePasswordInput, changePasswordSchema, DeleteAccountInput, deleteAccountSchema, Me (+11 more)

### Community 48 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, ng, prebuild, pretypecheck, start, test (+2 more)

### Community 49 - "AccountPage"
Cohesion: 0.18
Nodes (5): PageStateService, Injectable, GamesService, Injectable, SearchSnapshot

### Community 54 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 60 - "feedback.service.ts"
Cohesion: 0.50
Nodes (4): ConfirmRequest, PendingConfirm, Toast, ToastTone

## Knowledge Gaps
- **403 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+398 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthStore` connect `App` to `game.service.ts`, `ApiService`, `seat.ts`, `api.service.ts`, `friend.service.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `auth()` connect `tokens.ts` to `game.service.ts`, `5. Features`, `newPublicId`, `auth.service.ts`, `App`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `SocialService` connect `SocialService` to `game.service.ts`, `AccountPage`, `seat.ts`, `api.service.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `AuthStore` (e.g. with `authGuard()` and `guestGuard()`) actually correct?**
  _`AuthStore` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _403 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Build Prompt — Board & Card Game Management Web App ("Ludoteca")` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `5. Features` be split into smaller, more focused modules?**
  _Cohesion score 0.0784313725490196 - nodes in this community are weakly interconnected._