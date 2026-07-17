import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  addListItemSchema,
  bulkActionResultSchema,
  bulkActionSchema,
  createListSchema,
  exportQuerySchema,
  listItemSchema,
  listItemsQuerySchema,
  listItemsResultSchema,
  listSchema,
  okSchema,
  publicIdSchema,
  updateListItemSchema,
  updateListSchema,
} from '@ludoteca/shared';
import { rateLimits } from '../plugins/20-rate-limit.js';
import { exportFilename, toCsv, toJsonExport, toNamesExport } from '../modules/lists/export.js';
import * as listService from '../modules/lists/list.service.js';

const listIdParam = z.object({ listId: publicIdSchema });
const itemParams = z.object({ listId: publicIdSchema, itemId: publicIdSchema });

const listRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/lists',
    {
      onRequest: app.authenticate,
      schema: { response: { 200: z.array(listSchema) } },
    },
    async (request) => listService.listsForUser(request.currentUser!),
  );

  app.post(
    '/lists',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { body: createListSchema, response: { 201: listSchema } },
    },
    async (request, reply) => {
      const list = await listService.createList(request.currentUser!, request.body.name);
      return reply.code(201).send(list);
    },
  );

  app.patch(
    '/lists/:listId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: listIdParam, body: updateListSchema, response: { 200: listSchema } },
    },
    async (request) =>
      listService.renameList(request.currentUser!, request.params.listId, request.body.name),
  );

  app.delete(
    '/lists/:listId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: listIdParam, response: { 200: okSchema } },
    },
    async (request) => {
      await listService.deleteList(request.currentUser!, request.params.listId);
      return { ok: true as const };
    },
  );

  /**
   * A list's items. Readable by anyone the privacy rules allow — including
   * anonymous callers for fully public lists — so `authenticate` is deliberately
   * absent and getViewableList decides what, if anything, is visible.
   */
  app.get(
    '/lists/:listId/items',
    {
      schema: {
        params: listIdParam,
        querystring: listItemsQuerySchema,
        response: { 200: listItemsResultSchema },
      },
    },
    async (request) => {
      const { list, visiblePrivacies, isOwner } = await listService.getViewableList(
        request.currentUser,
        request.params.listId,
      );
      // Loan state travels only to the owner — see withLoans().
      return listService.listItemsPage(
        list.id,
        visiblePrivacies,
        request.query,
        isOwner ? list.ownerId : null,
      );
    },
  );

  /**
   * The same data as a Server-Sent Events stream (spec §5.3): the client paints
   * skeletons, then fills rows in as they arrive rather than waiting on the
   * whole set. Chunked in small batches so a large collection renders
   * progressively instead of landing as one block.
   */
  app.get(
    '/lists/:listId/items/stream',
    {
      config: { rateLimit: rateLimits.bulk },
      schema: { params: listIdParam, querystring: listItemsQuerySchema },
    },
    async (request, reply) => {
      const { list, visiblePrivacies, isOwner } = await listService.getViewableList(
        request.currentUser,
        request.params.listId,
      );
      const items = await listService.allListItems(
        list.id,
        visiblePrivacies,
        request.query,
        isOwner ? list.ownerId : null,
      );

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Tells nginx and friends not to buffer the stream into oblivion.
        'X-Accel-Buffering': 'no',
      });

      const send = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      send('meta', { total: items.length });

      const BATCH = 12;
      for (let i = 0; i < items.length; i += BATCH) {
        // Stop doing work the moment the client walks away, instead of
        // streaming into a closed socket.
        if (reply.raw.destroyed) {
          request.log.debug('sse client disconnected mid-stream');
          return reply;
        }
        send('items', items.slice(i, i + BATCH));
        // Yield to the event loop so the batch is actually flushed rather than
        // coalesced into one write at the end.
        await new Promise((resolve) => setImmediate(resolve));
      }

      send('done', { total: items.length });
      reply.raw.end();
      return reply;
    },
  );

  app.post(
    '/lists/:listId/items',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.search },
      schema: { params: listIdParam, body: addListItemSchema, response: { 201: listItemSchema } },
    },
    async (request, reply) => {
      const item = await listService.addItem(
        request,
        request.currentUser!,
        request.params.listId,
        request.body,
      );
      return reply.code(201).send(item);
    },
  );

  app.patch(
    '/lists/:listId/items/:itemId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: itemParams, body: updateListItemSchema, response: { 200: listItemSchema } },
    },
    async (request) =>
      listService.updateItem(
        request,
        request.currentUser!,
        request.params.listId,
        request.params.itemId,
        request.body,
      ),
  );

  app.delete(
    '/lists/:listId/items/:itemId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: itemParams, response: { 200: okSchema } },
    },
    async (request) => {
      await listService.removeItem(request.currentUser!, request.params.listId, request.params.itemId);
      return { ok: true as const };
    },
  );

  app.post(
    '/lists/:listId/items/bulk',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.bulk },
      schema: { params: listIdParam, body: bulkActionSchema, response: { 200: bulkActionResultSchema } },
    },
    async (request) =>
      listService.bulkAction(request, request.currentUser!, request.params.listId, request.body),
  );

  /**
   * Export (spec §5.3). Owner-only: unlike the item list, an export is a bulk
   * extraction, so it isn't offered for other people's lists at any privacy
   * level.
   */
  app.get(
    '/lists/:listId/export',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.bulk },
      schema: { params: listIdParam, querystring: exportQuerySchema },
    },
    async (request, reply) => {
      const list = await listService.getOwnedList(request.currentUser!, request.params.listId);
      // Export is owner-only, so every privacy level is in scope and loan state
      // is theirs to see. `loan: 'all'` — an export is the whole shelf.
      const all = await listService.allListItems(
        list.id,
        ['public', 'friends', 'nobody'],
        { page: 1, pageSize: 100, sort: 'added_at', dir: 'desc', type: 'all', loan: 'all' },
        list.ownerId,
      );
      const items = listService.filterToSelection(all, request.query.itemIds);
      const format = request.query.format;

      const { body, contentType, extension } = (() => {
        switch (format) {
          case 'csv':
            return { body: toCsv(items), contentType: 'text/csv; charset=utf-8', extension: 'csv' as const };
          case 'names':
            return { body: toNamesExport(items), contentType: 'text/plain; charset=utf-8', extension: 'txt' as const };
          case 'json':
            return {
              body: toJsonExport(items, list.name),
              contentType: 'application/json; charset=utf-8',
              extension: 'json' as const,
            };
        }
      })();

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${exportFilename(list.name, extension)}"`)
        // The browser must not sniff this into something executable.
        .header('X-Content-Type-Options', 'nosniff')
        .send(body);
    },
  );
};

export default listRoutes;
