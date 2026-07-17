import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

/**
 * The single exit point for every failure. Its job is to say as little as
 * possible: clients get a stable envelope and a generic message, while the
 * full reason goes to the log keyed by request id.
 */
async function errorHandlerPlugin(app: FastifyInstance) {
  app.setNotFoundHandler(
    // A 404 flood is a scan; rate-limit it like any other endpoint.
    { preHandler: app.rateLimit({ max: 60, timeWindow: '1 minute' }) },
    (request, reply) => {
      reply.code(404).send({
        error: { code: 'not_found', message: 'Not found.', requestId: request.id },
      });
    },
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // The zod guards below take `unknown`, so TypeScript widens `error` away in
    // their negative branches. Keep the typed handle for the tail of the chain.
    const err: FastifyError = error;

    // 1. Request failed zod validation — the one case where field detail is
    //    safe and useful, since the client sent the data in the first place.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string> = {};
      for (const issue of error.validation) {
        const path = issue.instancePath?.replace(/^\//, '').replace(/\//g, '.') || '_';
        fields[path] = issue.message ?? 'Invalid value';
      }
      request.log.info({ fields }, 'request validation failed');
      return reply.code(422).send({
        error: {
          code: 'validation_failed',
          message: 'Some fields are invalid.',
          fields,
          requestId: request.id,
        },
      });
    }

    // 2. We tried to send something that doesn't match our own response schema.
    //    That's our bug, and the payload may hold data the client shouldn't
    //    see — so log loudly and return a bare 500.
    if (isResponseSerializationError(error)) {
      request.log.error(
        { err: error, route: error.method ? `${error.method} ${error.url}` : undefined },
        'response serialization failed — schema and handler disagree',
      );
      return reply.code(500).send({
        error: { code: 'internal_error', message: 'Something went wrong.', requestId: request.id },
      });
    }

    // 3. Deliberate, expected failure raised by our own code.
    if (error instanceof AppError) {
      request.log.info(
        { code: error.code, detail: error.detail, status: error.status },
        'request rejected',
      );
      return reply.code(error.status).send(error.toPayload(request.id));
    }

    // 4. Payload too large, malformed JSON, and friends: Fastify sets a status
    //    but its default message can echo input back, so we replace the text.
    const status = err.statusCode ?? 500;
    if (status === 413) {
      return reply.code(413).send({
        error: { code: 'bad_request', message: 'Payload too large.', requestId: request.id },
      });
    }
    if (status === 429) {
      // @fastify/rate-limit sets Retry-After (seconds); surface it so a client
      // knows how long to wait rather than guessing.
      const retryAfter = reply.getHeader('retry-after');
      return reply.code(429).send({
        error: {
          code: 'rate_limited',
          message: retryAfter ? `Too many requests. Retry in ${retryAfter}s.` : 'Too many requests.',
          requestId: request.id,
        },
      });
    }
    if (status >= 400 && status < 500) {
      request.log.info({ err }, 'client error');
      return reply.code(status).send({
        error: { code: 'bad_request', message: 'Invalid request.', requestId: request.id },
      });
    }

    // 5. Anything else is an unhandled bug.
    //
    // The message is generic in every environment, dev included. An unhandled
    // error's text is arbitrary: a driver-level failure here once carried the
    // failed INSERT *and its bound parameters* — password hash included. There
    // is no safe way to echo something we haven't inspected, so we don't.
    // The full error is in the log under this same requestId.
    request.log.error({ err }, 'unhandled error');
    return reply.code(500).send({
      error: {
        code: 'internal_error',
        message: 'Something went wrong.',
        requestId: request.id,
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler', dependencies: ['rate-limit'] });
