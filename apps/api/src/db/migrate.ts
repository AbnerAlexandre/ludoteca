import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, db, sql } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Wait for the database to accept connections before migrating.
 *
 * This runs at container boot, and on a platform like Railway the app and its
 * Postgres come up in parallel — the database may not be listening yet the
 * instant this process starts. A single failed connection here would exit the
 * script, and since the start command is `migrate && start`, the server would
 * never bind its port. The deploy healthcheck then hits nothing and reports
 * "service unavailable".
 *
 * So we retry with backoff (capped ~60s) and only give up if the database is
 * genuinely unreachable — in which case failing the boot is correct, and the
 * platform restarts us.
 */
async function waitForDatabase(): Promise<void> {
  const maxAttempts = 15;
  const maxDelayMs = 8000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sql`select 1`;
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), maxDelayMs);
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`Database not ready (attempt ${attempt}/${maxAttempts}): ${reason}. Retrying in ${delay}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function main() {
  await waitForDatabase();

  const folder = join(here, '..', '..', 'drizzle');
  console.log(`Applying migrations from ${folder}`);
  await migrate(db, { migrationsFolder: folder });
  console.log('Migrations applied.');
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    await closeDb();
    // Exit non-zero so the start command's `&&` stops and the platform retries,
    // rather than booting a server against a database we couldn't migrate.
    process.exit(1);
  });
