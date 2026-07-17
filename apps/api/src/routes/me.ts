import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { meSchema, updateProfileSchema } from '@ludoteca/shared';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { audit } from '../lib/audit.js';
import { Errors } from '../lib/errors.js';
import { toMe } from '../modules/users/user.mapper.js';

const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    { onRequest: app.authenticate, schema: { response: { 200: meSchema } } },
    async (request) => toMe(request.currentUser!),
  );

  app.patch(
    '/me',
    {
      onRequest: [app.csrfProtection, app.authenticate],
      schema: { body: updateProfileSchema, response: { 200: meSchema } },
    },
    async (request) => {
      const user = request.currentUser!;
      const { displayName, defaultGamePrivacy } = request.body;

      const [updated] = await db
        .update(users)
        .set({
          ...(displayName !== undefined ? { displayName } : {}),
          ...(defaultGamePrivacy !== undefined ? { defaultGamePrivacy } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
      if (!updated) throw Errors.notFound('User');

      // A privacy-default change is security-relevant (spec §6.10). Note that
      // it only affects items added from here on — existing items keep the
      // privacy they were saved with, so nothing silently becomes public.
      if (defaultGamePrivacy && defaultGamePrivacy !== user.defaultGamePrivacy) {
        await audit(request, 'privacy.default_changed', {
          metadata: { from: user.defaultGamePrivacy, to: defaultGamePrivacy },
        });
      }

      return toMe(updated);
    },
  );
};

export default meRoutes;
