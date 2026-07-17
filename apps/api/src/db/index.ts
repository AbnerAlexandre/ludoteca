import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env, isProd } from '../config/env.js';
import * as schema from './schema.js';

/**
 * One pool for the process. postgres-js parameterizes everything it sends, so
 * every query built through Drizzle is bound — see SECURITY.md ("SQL injection").
 */
export const sql = postgres(env.DATABASE_URL, {
  max: isProd ? 20 : 5,
  idle_timeout: 30,
  connect_timeout: 10,
  // Silence postgres-js's own notice output; our logger owns stdout.
  onnotice: () => {},
});

export const db = drizzle(sql, { schema, logger: false });

export type Database = typeof db;
export { schema };

export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}
