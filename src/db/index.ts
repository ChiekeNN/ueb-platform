import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The database client is created lazily, on first use, rather than at module
 * load.
 *
 * Reading `process.env.DATABASE_URL` at the top level made every import of this
 * module throw when the variable was absent — and Next.js imports the API route
 * modules while collecting page data, so a missing variable failed the *build*
 * ("Failed to collect page data for /api/checkin") before a single request was
 * served. Deferring the connection means the build only needs the source, while
 * a missing variable still surfaces loudly the moment a query is attempted.
 */

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: Db;
};

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required — set it to a PostgreSQL connection string. " +
        "Locally: add it to .env. On Vercel: Project → Settings → Environment Variables, then redeploy.",
    );
  }
  return url;
}

function createDb() {
  return drizzle(getPool());
}

type Db = ReturnType<typeof createDb>;

function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) return globalForDb.__arenaNextJsPostgresqlPool;

  const pool = new Pool({ connectionString: requireDatabaseUrl() });

  // Reuse the pool across hot reloads in development.
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }
  return pool;
}

function getDb(): Db {
  if (globalForDb.__arenaNextJsPostgresqlDb) return globalForDb.__arenaNextJsPostgresqlDb;

  const db = createDb();
  globalForDb.__arenaNextJsPostgresqlDb = db;
  return db;
}

/** Forwards every property access to the lazily-created pool. */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const value = Reflect.get(getPool(), prop);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(getPool()) : value;
  },
});

/** Forwards every property access to the lazily-created Drizzle instance. */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = Reflect.get(getDb(), prop);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(getDb()) : value;
  },
});
