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
    allowList: () => isTest,
    errorResponseBuilder: (request, context) => ({
      error: {
        code: 'rate_limited',
        message: `Too many requests. Retry in ${Math.ceil(context.ttl / 1000)}s.`,
        requestId: request.id,
      },
    }),
  });
}

export default fp(rateLimitPlugin, { name: 'rate-limit', dependencies: ['security'] });
