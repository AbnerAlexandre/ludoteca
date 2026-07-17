import type { UserRow } from '../db/schema.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by the auth plugin when a valid access cookie is present. */
    currentUser: UserRow | null;
  }

  interface FastifyInstance {
    /** preHandler that rejects anonymous callers with a generic 401. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    /** Only the opaque public id travels in the token — never the internal uuid. */
    payload: { sub: string };
    user: { sub: string };
  }
}

export {};
