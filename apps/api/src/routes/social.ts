import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createFriendGroupSchema,
  createLoanSchema,
  friendGroupDetailSchema,
  friendGroupSchema,
  friendRequestSchema,
  friendsListSchema,
  groupDirectoryQuerySchema,
  groupDirectoryResultSchema,
  groupGamesQuerySchema,
  groupGamesResultSchema,
  groupInviteSchema,
  groupMemberIdsSchema,
  loanSchema,
  loansQuerySchema,
  loansResultSchema,
  loanStatusSchema,
  okSchema,
  paginationSchema,
  publicIdSchema,
  sendFriendRequestSchema,
  setGroupRoleSchema,
  updateFriendGroupSchema,
  userProfileSchema,
  userSearchQuerySchema,
  userSearchResultSchema,
} from '@ludoteca/shared';
import { rateLimits } from '../plugins/20-rate-limit.js';
import * as friendService from '../modules/social/friend.service.js';
import * as groupService from '../modules/social/group.service.js';
import * as loanService from '../modules/social/loan.service.js';
import { userProfile } from '../modules/users/profile.service.js';

const groupIdParam = z.object({ groupId: publicIdSchema });
const groupMemberParams = z.object({ groupId: publicIdSchema, userId: publicIdSchema });

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

  // --- User profile ---------------------------------------------------------

  app.get(
    '/users/:userId/profile',
    {
      onRequest: app.authenticate,
      schema: { params: z.object({ userId: publicIdSchema }), response: { 200: userProfileSchema } },
    },
    async (request) => userProfile(request.currentUser, request.params.userId),
  );

  // --- Friend groups --------------------------------------------------------

  app.get(
    '/groups',
    { onRequest: app.authenticate, schema: { response: { 200: z.array(friendGroupSchema) } } },
    async (request) => groupService.groupsFor(request.currentUser!),
  );

  /** Open groups anyone can ask to join. */
  app.get(
    '/groups/directory',
    {
      onRequest: app.authenticate,
      config: { rateLimit: rateLimits.search },
      schema: { querystring: groupDirectoryQuerySchema, response: { 200: groupDirectoryResultSchema } },
    },
    async (request) => groupService.directory(request.currentUser!, request.query),
  );

  /** The caller's pending group invites. */
  app.get(
    '/groups/invites',
    { onRequest: app.authenticate, schema: { response: { 200: z.array(groupInviteSchema) } } },
    async (request) => groupService.invitesFor(request.currentUser!),
  );

  app.post(
    '/groups',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { body: createFriendGroupSchema, response: { 201: friendGroupDetailSchema } },
    },
    async (request, reply) => {
      const group = await groupService.createGroup(request, request.currentUser!, request.body);
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
    async (request) => groupService.updateGroup(request.currentUser!, request.params.groupId, request.body),
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

  /** Admin invites people to the group (they must accept). */
  app.post(
    '/groups/:groupId/members',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, body: groupMemberIdsSchema, response: { 200: friendGroupDetailSchema } },
    },
    async (request) =>
      groupService.inviteMembers(request.currentUser!, request.params.groupId, request.body.memberIds),
  );

  /** The invitee accepts their invite. */
  app.post(
    '/groups/:groupId/accept',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupIdParam, response: { 200: friendGroupDetailSchema } },
    },
    async (request) => groupService.acceptInvite(request, request.currentUser!, request.params.groupId),
  );

  /** Any user asks to join an open group. */
  app.post(
    '/groups/:groupId/join',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.bulk },
      schema: { params: groupIdParam, response: { 200: okSchema } },
    },
    async (request) => {
      await groupService.requestToJoin(request, request.currentUser!, request.params.groupId);
      return { ok: true as const };
    },
  );

  /** Admin approves a pending join request. */
  app.post(
    '/groups/:groupId/members/:userId/approve',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupMemberParams, response: { 200: friendGroupDetailSchema } },
    },
    async (request) =>
      groupService.approveRequest(request.currentUser!, request.params.groupId, request.params.userId),
  );

  /** Owner promotes/demotes a member (admin ↔ member). */
  app.patch(
    '/groups/:groupId/members/:userId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupMemberParams, body: setGroupRoleSchema, response: { 200: friendGroupDetailSchema } },
    },
    async (request) =>
      groupService.setMemberRole(
        request.currentUser!,
        request.params.groupId,
        request.params.userId,
        request.body.role,
      ),
  );

  /** Remove a member / reject a request / revoke an invite; or leave yourself. */
  app.delete(
    '/groups/:groupId/members/:userId',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { params: groupMemberParams, response: { 200: okSchema } },
    },
    async (request) => {
      await groupService.removeMember(request.currentUser!, request.params.groupId, request.params.userId);
      return { ok: true as const };
    },
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
