# Build Prompt — Board & Card Game Management Web App ("Ludoteca")

You are building a production-grade web application for managing board game and card game collections, integrated with the **Ludopedia API** (a Brazilian board game platform). Follow this spec precisely. Ask before making irreversible architectural changes that contradict it.

---

## 1. Tech Stack (non-negotiable)

- **Frontend:** Angular (latest stable LTS), standalone components, **signals** for state, typed reactive forms, Angular Router with lazy-loaded feature routes.
- **Backend:** Node.js with **Fastify** (TypeScript, ESM), organized with `fastify-plugin` and route autoloading.
- **Database:** **PostgreSQL 16**, provisioned via **Docker** (`docker-compose`). Use **Drizzle ORM** with typed schema and migrations.
- **Monorepo:** single repo with `apps/api` (Fastify), `apps/web` (Angular), and `packages/shared` (shared TypeScript types / DTOs / zod schemas consumed by both sides).
- **Package manager:** pnpm workspaces.
- **Validation:** zod schemas in `packages/shared`, reused for Fastify request validation and Angular form validation.

Deliver a working `docker-compose.yml` that brings up PostgreSQL (and optionally the API) with one command, plus a documented local dev flow.

---

## 2. Configuration & Secrets

All secrets live in a **backend-only** `.env` file (git-ignored). Provide a `.env.example` with placeholder values.

```env
# Ludopedia API — SERVER-SIDE ONLY. Never expose to the browser.
LUDOPEDIA_APP_ID=23df60379b83b5fb
LUDOPEDIA_APP_KEY=7f8192924a654ac6dda49ab659f81b71
LUDOPEDIA_ACCESS_TOKEN=6db4215cdcce1ad33629580bfaa39ecf

# App
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ludoteca
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
COOKIE_SECRET=change-me
NODE_ENV=development
WEB_ORIGIN=http://localhost:4200

# Google OAuth (leave empty for now; wire up later)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Critical rules:**
- The Ludopedia `APP_KEY` and `ACCESS_TOKEN` must **never** reach the frontend bundle, a response body, or a log line. All Ludopedia calls are proxied through a backend service.
- Add `.env` to `.gitignore`. Fail fast on startup if required env vars are missing (validate env with a zod schema).

---

## 3. Ludopedia Integration Layer

Build a backend `LudopediaService` that wraps the Ludopedia REST API (docs: `https://ludopedia.com.br/api/documentacao.html`), authenticating with the `ACCESS_TOKEN` as a Bearer token.

- Endpoints to wrap: **game search** (returns games ordered by ranking), game detail, and any collection/match endpoints needed.
- Normalize Ludopedia responses into internal DTOs (id, ludopedia_id, name, type, thumbnail/cover, year, players, etc.).
- **Cache** searched/fetched games in a local `games` table to reduce redundant Ludopedia calls; refresh on a TTL.
- Add resilient error handling: timeouts, retry with backoff on 5xx, graceful degradation if Ludopedia is down.
- Expose only sanitized proxy endpoints to the frontend (e.g. `GET /api/games/search?q=...`), never the raw upstream.

---

## 4. Data Model (PostgreSQL / Drizzle)

Design at least these entities (add fields as needed):

**users**
- `id` (uuid, PK, internal — never exposed in URLs)
- `public_id` (short opaque id — used in all public URLs/APIs to prevent IDOR/enumeration)
- `login` (unique)
- `email` (unique)
- `password_hash` (argon2id; nullable if Google-only)
- `last_login_at`
- `google_connected` (boolean)
- `google_id` (nullable, unique)
- `default_game_privacy` (enum: `friends` | `public` | `nobody`, default `public`)
- `created_at`, `updated_at`

**friendships** — requester_id, addressee_id, `status` (`pending` | `accepted`), timestamps. Support: send request, accept/reject, unfriend.

**friend_groups** — id, owner_id, name. **friend_group_members** — group_id, user_id. A group lets you view the aggregated games of all members and see **who owns each game**.

**games** — cached catalog: id, ludopedia_id (unique), name, type (`board` | `cards` | ...), cover/thumbnail, metadata.

**lists** — id, owner_id, name, `kind` (`collection` | `wishlist` | `favorites` | `custom`). Default seeded lists per user.

**list_items** — id, list_id, game_id, `added_at`, `privacy` (inherits user default, overridable: `friends` | `public` | `nobody`). A game's visibility to others is enforced by this privacy setting.

**loans** — id, game_id, lender_id (owner), borrower_id, `status` (`requested` | `active` | `returned`), start/return dates. Support lending a game to a friend and tracking returns.

---

## 5. Features

### 5.1 Accounts & Auth
- Email/password **registration** and **login**.
- **Delete account** (hard delete with confirmation; cascade or anonymize related data).
- **Per-game / per-list privacy**: `friends`, `public`, `nobody`, with a user-level **default (public)** applied to new items.
- **Google OAuth**: scaffold the flow and UI button but keep it disabled behind a feature flag until keys are generated. Design so that when a Google login arrives, it **links to an existing account by matching email** (and sets `google_connected = true` / stores `google_id`); otherwise create a new account.
- Session model: short-lived **JWT access token** + rotating **refresh token**, both in `httpOnly`, `Secure`, `SameSite` cookies. Update `last_login_at` on login.

### 5.2 Social
- **Search users** (by login/public data; respects privacy).
- **Add friends**: send/accept/reject requests, unfriend. Clear pending-request management UI.
- **Friend groups**: create a group, add friends, and view **all games owned across the group**, with an indicator of **which members own each game**.
- **Lend games**: request/lend a game to a friend, track active loans and returns.

### 5.3 Collections & Usage
- **Search games** via the Ludopedia proxy and add them to lists.
- Built-in lists: **My Games (collection)**, **Want to Buy (wishlist)**, and optional **Favorites**. Allow **custom lists**.
- Inside any list:
  - Toggle between **card view** and **grid view**.
  - **Customizable pagination** (user-selectable page size).
  - **Streaming / progressive data loading** for good visual feedback (skeleton loaders + incremental rendering; use SSE or chunked fetching for large sets so the UI fills in as data arrives rather than blocking).
  - **Customizable sorting**: by name, date added, and type (`cards`, `board`, etc.), ascending/descending.
  - **Bulk actions on selected items**: multi-select, **select all**, **remove**, **favorite**, **add to another list**, and **export** the selection (CSV + JSON).

---

## 6. Security (application will undergo a penetration test)

Implement defense in depth. Each layer must have a clear, documented responsibility.

1. **Transport & headers:** HTTPS assumed in prod; `@fastify/helmet` with a strict Content-Security-Policy, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, referrer policy.
2. **CORS:** `@fastify/cors` with a strict origin allowlist (`WEB_ORIGIN`), credentials enabled only for that origin.
3. **AuthN:** argon2id password hashing, short-lived access JWT + rotating refresh tokens in `httpOnly`/`Secure`/`SameSite=strict` cookies. **CSRF protection** for cookie-based mutating requests (double-submit token or SameSite + origin check).
4. **AuthZ / IDOR prevention:** every resource access re-checks ownership and privacy on the server. Use `public_id` (opaque) in all external references; never expose or accept internal sequential/UUID ids in a way that allows enumeration.
5. **Input validation:** validate **every** request (body, params, query) against zod/Fastify schemas. Enforce **max-length limits** on all string fields, strict types, reject unknown properties, cap array sizes, and set a JSON **body size limit**.
6. **Rate limiting:** `@fastify/rate-limit` globally, with **stricter limits on auth endpoints** (login/register/refresh) and on the Ludopedia search proxy. Add **brute-force protection** (progressive delay / temporary lockout after repeated failed logins) to mitigate spam and DDoS-style abuse.
7. **Output safety:** generic error messages to clients (no stack traces, no internal ids), consistent error envelope, no leaking whether an email/login exists on failed auth.
8. **SQL injection:** parameterized queries only, via Drizzle. No string-built SQL.
9. **Secrets hygiene:** Ludopedia keys and JWT secrets server-side only; redact secrets from logs.
10. **Auditing:** log security-relevant events (login, failed login, account deletion, privacy changes) with request ids, without logging sensitive payloads.
11. **Dependencies:** pin versions; include an audit/scan step in the README.

Document the security model in a `SECURITY.md` mapping each control to the threat it addresses.

---

## 7. UI / UX

- **Modern, young, energetic aesthetic** — bold typography, a vibrant but coherent color system with light/dark themes, generous spacing, and a distinctive look (avoid default framework styling).
- **Fully responsive**, **mobile-first**; every screen must be fully usable on a phone (touch targets, mobile nav, no horizontal scroll).
- **Smooth animations & micro-interactions**: page/route transitions, list item enter/leave animations, hover/press feedback, skeleton loaders, and satisfying selection/bulk-action feedback (use Angular animations API + CSS).
- Use TailwindCSS for the design system; a component lib (PrimeNG or Angular Material) is optional for complex widgets, but the visual identity must be custom, not stock.
- Accessible: semantic HTML, keyboard navigation, focus states, ARIA where needed, sufficient contrast.

---

## 8. Deliverables

- Working monorepo with the structure above.
- `docker-compose.yml` for PostgreSQL (one-command up).
- Drizzle schema + migrations + a seed script (sample user, sample lists).
- Fastify API with all endpoints, validation, and security layers wired.
- Angular app implementing all screens and features.
- `README.md` with setup/run instructions, `.env.example`, and the local dev flow.
- `SECURITY.md` documenting the layered controls.

---

## 9. Build Order (suggested)

1. Monorepo scaffold + Docker Postgres + Drizzle schema & migrations.
2. Fastify core: env validation, security plugins (helmet, cors, rate-limit, cookie), error envelope, health check.
3. Auth (register/login/refresh/delete, argon2, JWT+cookies, CSRF), Google OAuth scaffold behind a flag.
4. Ludopedia proxy service + game cache + search endpoint.
5. Lists & list-items (views, pagination, sorting, streaming, bulk actions, export).
6. Social (friends, groups, group game aggregation, loans).
7. Angular UI polish: theming, animations, responsive passes, accessibility.
8. Security hardening pass + `SECURITY.md` + final review against this spec.

Start by confirming the scaffold plan, then proceed.