import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env, isProd } from '../config/env.js';

/**
 * Layer 1 of the defence in depth: transport headers and origin control.
 * Runs before anything else so even a 404 leaves with the right headers.
 */
async function securityPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    // The API serves JSON only — it never renders HTML, so the safest possible
    // CSP is one that permits nothing at all. The Angular app ships its own.
    // useDefaults:false matters: helmet would otherwise merge in script-src
    // 'self', img-src, style-src 'unsafe-inline' and friends, which have no
    // business on a JSON endpoint.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
        'sandbox': [],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    // Only meaningful over HTTPS; browsers ignore it on http anyway, but we
    // keep it off in dev so a stray localhost HSTS pin can't wedge the browser.
    hsts: isProd ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    xFrameOptions: { action: 'deny' },
    noSniff: true,
    xDnsPrefetchControl: { allow: false },
  });

  await app.register(cors, {
    // Exact-match allowlist, not a regex and not a reflection of Origin.
    // Reflecting the origin with credentials:true would let any site read
    // authenticated responses.
    origin: [env.WEB_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  });

  // Defence in depth behind CORS: a browser preflight can be skipped for
  // "simple" requests, so we also reject cross-origin mutations server-side.
  app.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const origin = request.headers.origin;
    if (origin && origin !== env.WEB_ORIGIN) {
      app.log.warn({ origin, path: request.url }, 'rejected cross-origin mutation');
      return reply.code(403).send({
        error: { code: 'forbidden', message: 'Request rejected.', requestId: request.id },
      });
    }
  });
}

export default fp(securityPlugin, { name: 'security' });
