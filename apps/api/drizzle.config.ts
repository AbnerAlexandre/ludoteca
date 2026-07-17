import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside the app, so it can't lean on our zod env loader.
const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL is not set. Run drizzle-kit via the pnpm scripts so .env is loaded.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
