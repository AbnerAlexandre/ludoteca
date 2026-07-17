import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { isTest } from '../config/env.js';

/**
 * Bucket key. Authenticated traffic is counted per account so that everyone
 * behind one office NAT doesn't share a budget; anonymous traffic falls back
 * to the IP, which is all we have.
 */
function keyFor(request: FastifyRequest): string {
  return request.currentUser ? `u:${request.currentUser.id}` : `ip:${request.ip}`;
}

/**
 * Named limiter configs. Routes opt into the strict ones via
 * `config: { rateLimit: rateLimits.auth }` — the global limit below is only a
 * backstop against broad hammering.
 */
export const rateLimits = {
  /** Login/register/refresh: the endpoints worth brute-forcing. */
  auth: { max: 10, timeWindow: '5 minutes' },
  /** Account deletion and other one-shot destructive calls. */
  destructive: { max: 5, timeWindow: '1 hour' },
  /** The Ludopedia proxy — every miss costs us an upstream call. */
  search: { max: 30, timeWindow: '1 minute' },
  /** Bulk mutations and exports: expensive per request. */
  bulk: { max: 20, timeWindow: '1 minute' },
} as const;

async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // In-process store. A multi-instance deployment needs the Redis store here,
    // otherwise each instance enforces its own budget — see SECURITY.md.
    keyGenerator: keyFor,
    // Never rate-limit the test suite into flakiness.
    enableDraftSpec: true,
    skipOnError: false,
    // Health endpoints are never rate-limited. A platform healthcheck polls
    // them, and during a slow start it can poll faster than any budget allows —
    // a 429 there would fail the deploy for a service that is actually fine.
    allowList: (request) => isTest || request.url.startsWith('/api/health'),
    // No custom errorResponseBuilder: it returned a bare envelope object with
    // no statusCode, so when the plugin threw it, the error handler saw an
    // object it didn't recognize and fell through to a generic 500 — a
    // rate-limited request came back as "Something went wrong" instead of 429.
    // The default error carries statusCode 429; the error handler formats the
    // envelope (and reads the Retry-After header the plugin still sets).
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit', dependencies: ['security'] });
