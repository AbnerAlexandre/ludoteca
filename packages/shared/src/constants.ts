/**
 * Runtime values shared by both sides, deliberately free of any zod import.
 *
 * This file exists so the browser can read a constant without paying for the
 * validation library. Importing `LIMITS` from the package barrel evaluates the
 * barrel, which pulls in every zod schema — about 100 kB of parser the web app
 * never runs, since Angular mirrors these rules with its own Validators.
 *
 * Rule: nothing in here may import zod, directly or transitively. The schema
 * modules re-export from this file, never the other way round.
 */

/**
 * Every string field in the API has an explicit ceiling. Unbounded strings are
 * a DoS vector (huge payloads) and a storage-abuse vector, so the limits live
 * here and are reused by the Fastify schemas and the Angular forms alike.
 */
export const LIMITS = {
  login: { min: 3, max: 32 },
  email: { max: 254 },
  password: { min: 12, max: 128 },
  displayName: { max: 60 },
  listName: { min: 1, max: 60 },
  groupName: { min: 1, max: 60 },
  searchQuery: { min: 2, max: 80 },
  note: { max: 500 },
  bulkItems: 200,
  pageSize: { min: 1, max: 100, default: 24 },
} as const;

/** Length of the opaque public id used in every external reference. */
export const PUBLIC_ID_LENGTH = 12;

export const AUTH_COOKIES = {
  access: 'lt_access',
  refresh: 'lt_refresh',
  csrf: 'lt_csrf',
} as const;

export const CSRF_HEADER = 'x-csrf-token';
