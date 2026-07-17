import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, db } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const folder = join(here, '..', '..', 'drizzle');
  console.log(`Applying migrations from ${folder}`);
  await migrate(db, { migrationsFolder: folder });
  console.log('Migrations applied.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(closeDb);
