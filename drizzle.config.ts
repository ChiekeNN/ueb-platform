import { defineConfig } from "drizzle-kit";
import "dotenv/config";

/**
 * Drizzle reads its connection string from DATABASE_URL so the same config
 * works against a local database and a hosted one (Neon, Supabase, Vercel
 * Postgres). Set it in `.env` for local work and in the host's environment
 * for production migrations.
 *
 * The local default matches the setup steps in the README:
 *   postgresql://postgres:postgres@127.0.0.1:5432/app_db
 */
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: databaseUrl,
  },
});
