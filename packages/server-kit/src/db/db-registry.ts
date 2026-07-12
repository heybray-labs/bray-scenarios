import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * The composed application database handle.
 *
 * The app owns schema composition and creates the drizzle instance (via
 * `createDb`), then registers it here with `setDatabase()` at startup. Platform
 * packages read this live binding instead of importing the app's `db` module,
 * which keeps package -> app import direction clean. Consumers must access `db`
 * lazily (at request/query time), never at module top-level, since it is only
 * populated once the app registers it during boot.
 */
export let db: NodePgDatabase<any> = undefined as unknown as NodePgDatabase<any>;

export function setDatabase(instance: NodePgDatabase<any>): void {
  db = instance;
}
