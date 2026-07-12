import { existsSync } from "fs";

/**
 * When DATABASE_URL uses the Docker Compose service name `db`, rewrite to
 * `127.0.0.1` for host-side scripts (npm run db:init, db:seed-demo, etc.).
 * Inside the app container, `db` resolves via Docker DNS.
 *
 * Uses POSTGRES_PORT from the environment when set (must match docker-compose
 * port mapping) so host scripts can reach the container when local Postgres
 * already occupies 5432.
 */
export function resolveDatabaseUrl(url: string): string {
  if (!url.includes("@db:") || existsSync("/.dockerenv")) {
    return url;
  }

  const port = process.env.POSTGRES_PORT || "5432";
  return url.replace(/@db:\d+/, `@127.0.0.1:${port}`);
}
