import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDb } from './db/index.js';

const app = await buildApp();

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) app.log.error({ err }, 'shutting down after an unhandled error');
  else app.log.info({ signal }, 'shutting down');
  await app.close();
  await closeDb();
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  await closeDb();
  process.exit(1);
}
