import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  authSessionSchema,
  authStatusSchema,
  changePasswordSchema,
  deleteAccountSchema,
  loginInputSchema,
  okSchema,
  registerSchema,
} from '@ludoteca/shared';
import { env } from '../config/env.js';
import { audit } from '../lib/audit.js';
import { Errors } from '../lib/errors.js';
import { rateLimits } from '../plugins/20-rate-limit.js';
import * as authService from '../modules/auth/auth.service.js';
import { issueSession, revokeSession, rotateSession } from '../modules/auth/tokens.js';
import { toMe } from '../modules/users/user.mapper.js';

const auth: FastifyPluginAsyncZod = async (app) => {
  /**
   * The SPA's entry point. Unauthenticated and safe, and the only way to obtain
   * a CSRF token — every mutating route below requires one, including login.
   */
  app.get(
    '/auth/status',
    {
      schema: { response: { 200: authStatusSchema } },
    },
    async (request, reply) => {
      const csrfToken = reply.generateCsrf();
      return {
        authenticated: request.currentUser !== null,
        user: request.currentUser ? toMe(request.currentUser) : null,
        csrfToken,
        features: { googleOAuth: env.FEATURE_GOOGLE_OAUTH },
      };
    },
  );

  app.post(
    '/auth/register',
    {
      onRequest: app.csrfProtection,
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: registerSchema,
        response: { 201: authSessionSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.register(request, request.body);
      const csrfToken = await issueSession(request, reply, user);
      return reply.code(201).send({ user: toMe(user), csrfToken });
    },
  );

  app.post(
    '/auth/login',
    {
      onRequest: app.csrfProtection,
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: loginInputSchema,
        response: { 200: authSessionSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.login(request, request.body);
      const csrfToken = await issueSession(request, reply, user);
      return { user: toMe(user), csrfToken };
    },
  );

  /**
   * Rotates the refresh token. Not guarded by `authenticate`: the whole point
   * is that the access token has already expired.
   */
  app.post(
    '/auth/refresh',
    {
      onRequest: app.csrfProtection,
      config: { rateLimit: rateLimits.auth },
      schema: { response: { 200: authSessionSchema } },
    },
    async (request, reply) => {
      const { user, csrfToken } = await rotateSession(request, reply);
      await audit(request, 'auth.refresh', { userId: user.id });
      return { user: toMe(user), csrfToken };
    },
  );

  app.post(
    '/auth/logout',
    {
      onRequest: app.csrfProtection,
      schema: { response: { 200: okSchema } },
    },
    async (request, reply) => {
      const userId = request.currentUser?.id ?? null;
      await revokeSession(request, reply);
      await audit(request, 'auth.logout', { userId });
      return { ok: true as const };
    },
  );

  app.post(
    '/auth/password',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.auth },
      schema: {
        body: changePasswordSchema,
        response: { 200: okSchema },
      },
    },
    async (request, reply) => {
      const user = request.currentUser!;
      await authService.changePassword(request, user, request.body.currentPassword, request.body.newPassword);
      // Every session died, including this one. Clear the cookies so the client
      // doesn't sit on a token that will 401 on its next call.
      await revokeSession(request, reply);
      return { ok: true as const };
    },
  );

  app.delete(
    '/auth/account',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      config: { rateLimit: rateLimits.destructive },
      schema: {
        body: deleteAccountSchema,
        response: { 200: okSchema },
      },
    },
    async (request, reply) => {
      await authService.deleteAccount(request, request.currentUser!, request.body);
      await revokeSession(request, reply);
      return { ok: true as const };
    },
  );

  // --- Google OAuth (scaffolded, disabled) ----------------------------------
  //
  // Per spec §5.1 the flow exists in shape but stays behind FEATURE_GOOGLE_OAUTH
  // until real keys are issued. Both routes 404 while the flag is off — a
  // disabled feature shouldn't announce itself. The account-resolution half is
  // already written and tested: see linkOrCreateGoogleUser in auth.service.ts.

  app.get('/auth/google', { config: { rateLimit: rateLimits.auth } }, async (request) => {
    if (!env.FEATURE_GOOGLE_OAUTH) throw Errors.featureDisabled('google-oauth');

    // TODO(google-oauth): generate a state nonce + PKCE verifier, stash them in
    // a short-lived httpOnly cookie, and redirect to Google's consent URL. The
    // callback must reject any state that doesn't match.
    request.log.error('google oauth is flagged on but the redirect is not implemented');
    throw Errors.featureDisabled('google-oauth');
  });

  app.get('/auth/google/callback', { config: { rateLimit: rateLimits.auth } }, async (request) => {
    if (!env.FEATURE_GOOGLE_OAUTH) throw Errors.featureDisabled('google-oauth');

    // TODO(google-oauth): verify `state` against the cookie, exchange `code`
    // for tokens, verify the id_token signature, and require email_verified
    // before calling linkOrCreateGoogleUser — linking on an unverified email
    // would let anyone claim an account by registering its address. On success,
    // issueSession(...) then redirect to env.WEB_ORIGIN.
    request.log.error('google oauth is flagged on but the callback is not implemented');
    throw Errors.featureDisabled('google-oauth');
  });
};

export default auth;
