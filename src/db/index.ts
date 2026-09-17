import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// A missing DATABASE_URL should not take down the public discovery surfaces.
// Routes can fall back to the first-party demo catalogue while organisers set
// up PostgreSQL; write operations still return a clear database error.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:1/ueb_unconfigured";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
