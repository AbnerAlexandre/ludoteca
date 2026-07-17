import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AUTH_COOKIES, CSRF_HEADER } from '@ludoteca/shared';
import { env, isProd } from '../config/env.js';

/**
 * Base options for every auth cookie we set.
 *
 * - httpOnly: JS cannot read it, so an XSS bug cannot exfiltrate the session.
 * - sameSite strict: the browser won't attach it to cross-site requests at all,
 *   which is the primary CSRF defence; the token below is the backup.
 * - secure in prod only: a Secure cookie is dropped over plain http, which
 *   would break local dev on http://localhost.
 */
export const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
  signed: false,
} as const;

async function cookiesPlugin(app: FastifyInstance) {
  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: baseCookieOptions,
  });

  await app.register(csrf, {
    sessionPlugin: '@fastify/cookie',
    cookieKey: AUTH_COOKIES.csrf,
    cookieOpts: {
      // httpOnly, because this cookie holds the CSRF *secret*, not the token.
      // The token is what the SPA echoes back, and it is handed over in the
      // /auth/status response body. Anyone who can read the secret can mint a
      // valid token, so JavaScript must not be able to read it.
      ...baseCookieOptions,
      httpOnly: true,
    },
    getToken: (req) => {
      const header = req.headers[CSRF_HEADER];
      return Array.isArray(header) ? header[0] : header;
    },
  });
}

export default fp(cookiesPlugin, { name: 'cookies', dependencies: ['security'] });
