import type { FastifyServerOptions } from 'fastify';
import { isProd, isTest } from '../config/env.js';

/**
 * Redaction list. pino applies these paths before anything reaches a transport,
 * so a secret can't leak by someone logging a whole request or config object.
 * Anything added to the app that carries a credential belongs here.
 */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.tokenHash',
  '*.LUDOPEDIA_APP_KEY',
  '*.LUDOPEDIA_ACCESS_TOKEN',
  '*.JWT_ACCESS_SECRET',
  '*.JWT_REFRESH_SECRET',
  '*.COOKIE_SECRET',
  '*.DATABASE_URL',
];

export const loggerOptions: FastifyServerOptions['logger'] = isTest
  ? false
  : {
      level: isProd ? 'info' : 'debug',
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      // Log the shape of a request, never its contents.
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            // request.ip respects trustProxy; used for abuse correlation only.
            ip: request.ip,
          };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
      },
      ...(isProd
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname', colorize: true },
            },
          }),
    };
