import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { resolveDatabaseUrl } from "./resolve-database-url.ts";

export interface CreateDbResult<TSchema extends Record<string, unknown>> {
  db: NodePgDatabase<TSchema>;
  pool: pg.Pool;
}

/**
 * Create a pg pool + drizzle instance for the given composed schema. The app
 * owns schema composition; server-kit owns pool/driver wiring.
 */
export function createDb<TSchema extends Record<string, unknown>>(
  schema: TSchema,
  connectionString: string | undefined = process.env.DATABASE_URL,
): CreateDbResult<TSchema> {
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set");
  }
  const pool = new pg.Pool({ connectionString: resolveDatabaseUrl(connectionString) });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
