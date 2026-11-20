import { defineConfig } from 'drizzle-kit';

// Generate a migration after changing src/core/db/schema.ts:
//   npm run db:generate -w @recon/api -- --name=<change>
// Migrations are applied automatically when the API starts.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/core/db/schema.ts',
  out: './drizzle',
});
