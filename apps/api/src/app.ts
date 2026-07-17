import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import autoload from '@fastify/autoload';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { isProd } from './config/env.js';
import { loggerOptions } from './lib/logger.js';

const here = fileURLToPath(new URL('.', import.meta.url));

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    // 256 KB. Every legitimate request here is a small JSON document; the cap
    // stops a single client from making us buffer megabytes.
    bodyLimit: 256 * 1024,
    // Correlates a client-visible requestId with the server-side log line.
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: false,
    // Only honour X-Forwarded-* behind our own proxy, where it's trustworthy.
    // Off in dev, otherwise any client could spoof its IP past the rate limiter.
    trustProxy: isProd,
  }).withTypeProvider<ZodTypeProvider>();

  // zod owns both directions: it validates what comes in and, just as
  // importantly, strips response objects down to their declared schema — a
  // field that isn't in the schema cannot accidentally ship.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);

  // Numeric filename prefixes make the load order obvious at a glance; the
  // `dependencies` in each plugin is what actually enforces it.
  await app.register(autoload, {
    dir: join(here, 'plugins'),
    forceESM: true,
  });

  await app.register(autoload, {
    dir: join(here, 'routes'),
    options: { prefix: '/api' },
    forceESM: true,
  });

  return app;
}
