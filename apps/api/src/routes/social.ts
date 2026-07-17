import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createFriendGroupSchema,
  createLoanSchema,
  friendGroupDetailSchema,
  friendGroupSchema,
  friendRequestSchema,
  friendsListSchema,
  groupGamesQuerySchema,
  groupGamesResultSchema,
  groupMemberIdsSchema,
  loanSchema,
  loansQuerySchema,
  loansResultSchema,
  loanStatusSchema,
  okSchema,
  paginationSchema,
  publicIdSchema,
  sendFriendRequestSchema,
  updateFriendGroupSchema,
  userSearchQuerySchema,
  userSearchResultSchema,
} from '@ludoteca/shared';
import { rateLimits } from '../plugins/20-rate-limit.js';
import * as friendService from '../modules/social/friend.service.js';
import * as groupService from '../modules/social/group.service.js';
import * as loanService from '../modules/social/loan.service.js';

const groupIdParam = z.object({ groupId: publicIdSchema });

const socialRoutes: FastifyPluginAsyncZod = async (app) => {
  // --- Users & friends ------------------------------------------------------

  app.get(
    '/users/search',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.search },
      schema: { querystring: userSearchQuerySchema, response: { 200: userSearchResultSchema } },
    },
    async (request) => friendService.searchUsers(request.currentUser!, request.query),
  );

  app.get(
    '/friends',
    {
      onRequest: app.authenticate,
      schema: { querystring: paginationSchema, response: { 200: friendsListSchema } },
    },
    async (request) =>
      friendService.friendsOf(request.currentUser!, request.query.page, request.query.pageSize),
  );

  app.get(
    '/friends/requests',
    {
      onRequest: app.authenticate,
      schema: { response: { 200: z.array(friendRequestSchema) } },
    },
    async (request) => friendService.pendingRequests(request.currentUser!),
  );

  app.post(
    '/friends/requests',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.bulk },
      schema: { body: sendFriendRequestSchema, response: { 201: friendRequestSchema } },
    },
    async (request, reply) => {
      const result = await friendService.sendRequest(request, request.currentUser!, request.body.userId);
      return reply.code(201).send(result);
    },
  );

  app.post(
    '/friends/requests/:requestId/accept',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: z.object({ requestId: publicIdSchema }), response: { 200: friendRequestSchema } },
    },
    async (request) => friendService.acceptRequest(request, request.currentUser!, request.params.requestId),
  );

  /** Reject a request, withdraw one you sent, or unfriend — all the same row. */
  app.delete(
    '/friends/requests/:requestId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: z.object({ requestId: publicIdSchema }), response: { 200: okSchema } },
    },
    async (request) => {
      await friendService.removeFriendship(request, request.currentUser!, request.params.requestId);
      return { ok: true as const };
    },
  );

  app.delete(
    '/friends/:userId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: z.object({ userId: publicIdSchema }), response: { 200: okSchema } },
    },
    async (request) => {
      await friendService.unfriendUser(request, request.currentUser!, request.params.userId);
      return { ok: true as const };
    },
  );

  // --- Friend groups --------------------------------------------------------

  app.get(
    '/groups',
    { onRequest: app.authenticate, schema: { response: { 200: z.array(friendGroupSchema) } } },
    async (request) => groupService.groupsFor(request.currentUser!),
  );

  app.post(
    '/groups',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { body: createFriendGroupSchema, response: { 201: friendGroupDetailSchema } },
    },
    async (request, reply) => {
      const group = await groupService.createGroup(request.currentUser!, request.body);
      return reply.code(201).send(group);
    },
  );

  app.get(
    '/groups/:groupId',
    {
      onRequest: app.authenticate,
      schema: { params: groupIdParam, response: { 200: friendGroupDetailSchema } },
    },
    async (request) => groupService.groupDetail(request.currentUser!, request.params.groupId),
  );

  app.patch(
    '/groups/:groupId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, body: updateFriendGroupSchema, response: { 200: friendGroupDetailSchema } },
    },
    async (request) => groupService.renameGroup(request.currentUser!, request.params.groupId, request.body.name),
  );

  app.delete(
    '/groups/:groupId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, response: { 200: okSchema } },
    },
    async (request) => {
      await groupService.deleteGroup(request.currentUser!, request.params.groupId);
      return { ok: true as const };
    },
  );

  app.post(
    '/groups/:groupId/members',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, body: groupMemberIdsSchema, response: { 200: friendGroupDetailSchema } },
    },
    async (request) =>
      groupService.addMembers(request.currentUser!, request.params.groupId, request.body.memberIds),
  );

  app.delete(
    '/groups/:groupId/members',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, body: groupMemberIdsSchema, response: { 200: friendGroupDetailSchema } },
    },
    async (request) =>
      groupService.removeMembers(request.currentUser!, request.params.groupId, request.body.memberIds),
  );

  /** The aggregated shelf: every game across the group, with owners attributed. */
  app.get(
    '/groups/:groupId/games',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.bulk },
      schema: { params: groupIdParam, querystring: groupGamesQuerySchema, response: { 200: groupGamesResultSchema } },
    },
    async (request) => groupService.groupGames(request.currentUser!, request.params.groupId, request.query),
  );

  // --- Loans ----------------------------------------------------------------

  app.get(
    '/loans',
    {
      onRequest: app.authenticate,
      schema: { querystring: loansQuerySchema, response: { 200: loansResultSchema } },
    },
    async (request) => loanService.loansFor(request.currentUser!, request.query),
  );

  app.post(
    '/loans',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.bulk },
      schema: { body: createLoanSchema, response: { 201: loanSchema } },
    },
    async (request, reply) => {
      const loan = await loanService.createLoan(request, request.currentUser!, request.body);
      return reply.code(201).send(loan);
    },
  );

  app.patch(
    '/loans/:loanId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: {
        params: z.object({ loanId: publicIdSchema }),
        // 'requested' is not a target anyone can move *to* — a loan starts there.
        body: z.object({ status: loanStatusSchema.exclude(['requested']) }).strict(),
        response: { 200: loanSchema },
      },
    },
    async (request) =>
      loanService.updateLoanStatus(request, request.currentUser!, request.params.loanId, request.body.status),
  );
};

export default socialRoutes;
