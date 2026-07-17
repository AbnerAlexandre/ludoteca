import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { gameDetailSchema, gameSearchQuerySchema, gameSearchResultSchema, publicIdSchema } from '@ludoteca/shared';
import { rateLimits } from '../plugins/20-rate-limit.js';
import { toGameDetail } from '../modules/games/game.mapper.js';
import { getGameDetail, searchGames } from '../modules/games/game.service.js';

const gameRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The sanitized proxy (spec §3). Authenticated: an open search endpoint would
   * let anyone burn our Ludopedia quota, and it's rate-limited on top of that
   * because every cache miss costs an upstream call.
   */
  app.get(
    '/games/search',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.search },
      schema: {
        querystring: gameSearchQuerySchema,
        response: { 200: gameSearchResultSchema },
      },
    },
    async (request) => searchGames(request, request.query),
  );

  app.get(
    '/games/:gameId',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.search },
      schema: {
        params: z.object({ gameId: publicIdSchema }),
        response: { 200: gameDetailSchema },
      },
    },
    async (request) => toGameDetail(await getGameDetail(request, request.params.gameId)),
  );
};

export default gameRoutes;
