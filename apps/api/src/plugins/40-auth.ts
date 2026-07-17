import jwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { AUTH_COOKIES } from '@ludoteca/shared';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { Errors } from '../lib/errors.js';

/**
 * Identity resolution. This plugin only *establishes* who the caller is — it
 * never decides what they may do. Authorization is re-checked per resource in
 * the services, because a valid session says nothing about ownership.
 */
async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    // The token rides in an httpOnly cookie, not the Authorization header, so
    // there is nothing for page JS (or an XSS payload) to read.
    cookie: { cookieName: AUTH_COOKIES.access, signed: false },
    sign: { expiresIn: env.ACCESS_TOKEN_TTL, algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  app.decorateRequest('currentUser', null);

  /**
   * Resolve the session on every request, but never reject here: public routes
   * legitimately run anonymous, and they still want to know who's asking so
   * they can apply privacy rules.
   */
  app.addHook('onRequest', async (request) => {
    const token = request.cookies[AUTH_COOKIES.access];
    if (!token) return;

    let publicId: string;
    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      publicId = payload.sub;
    } catch {
      // Expired or tampered. Stay anonymous; the SPA will hit /auth/refresh.
      return;
    }

    // Look the user up every request rather than trusting claims baked into the
    // token: it costs one indexed read and makes deletion take effect at once,
    // instead of lingering until the access token expires.
    const user = await db.query.users.findFirst({ where: eq(users.publicId, publicId) });
    request.currentUser = user ?? null;
  });

  app.decorate('authenticate', async (request) => {
    if (!request.currentUser) throw Errors.notAuthenticated();
  });
}

export default fp(authPlugin, { name: 'auth', dependencies: ['cookies'] });
