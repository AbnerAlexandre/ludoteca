import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db/index.js';

const health: FastifyPluginAsyncZod = async (app) => {
  /** Liveness: is the process up? Cheap enough for a per-second probe. */
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({ status: z.literal('ok'), uptime: z.number() }),
        },
      },
    },
    async () => ({ status: 'ok' as const, uptime: Math.floor(process.uptime()) }),
  );

  /**
   * Readiness: can we actually serve traffic? Reports the database, and says
   * nothing about versions, hostnames, or connection strings — this endpoint
   * is unauthenticated, so it must not be a recon tool.
   */
  app.get(
    '/health/ready',
    {
      // No per-route rate limit: health endpoints are exempted globally in the
      // rate-limit plugin, because a healthcheck poller must never be throttled.
      schema: {
        response: {
          200: z.object({ status: z.literal('ready'), database: z.literal('up') }),
          503: z.object({ status: z.literal('degraded'), database: z.literal('down') }),
        },
      },
    },
    async (request, reply) => {
      try {
        await db.execute(sql`select 1`);
        return { status: 'ready' as const, database: 'up' as const };
      } catch (err) {
        request.log.error({ err }, 'readiness probe: database unreachable');
        return reply.code(503).send({ status: 'degraded' as const, database: 'down' as const });
      }
    },
  );
};

export default health;
