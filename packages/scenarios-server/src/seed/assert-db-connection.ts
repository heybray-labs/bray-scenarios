import { db } from "@heybray/server-kit";
import { sql } from "drizzle-orm";

export async function assertDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Configure it in .env (see .env.example).");
  }

  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && "cause" in error ? error.cause : null;
    const causeMessage =
      cause instanceof Error ? cause.message : cause != null ? String(cause) : "";
    const hints: string[] = [];

    if (databaseUrl.includes("@db:")) {
      hints.push(
        "DATABASE_URL uses Docker hostname db — host-side scripts rewrite this to 127.0.0.1 automatically.",
      );
      hints.push(
        "Ensure Docker Postgres is running: `docker compose up -d db` (from repo root).",
      );
      hints.push(
        "Or run the seed inside Docker: `npm run db:seed-demo:docker`",
      );
    } else if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
      hints.push(
        "No Postgres is listening on that host/port — start your local Postgres service, or run `docker compose up -d db`.",
      );
    }

    if (
      causeMessage.includes("role \"postgres\" does not exist") ||
      causeMessage.includes("password authentication failed")
    ) {
      hints.push(
        "Port 5432 may be used by a local Postgres instance instead of Docker. Set POSTGRES_PORT=5433 in .env, run `docker compose up -d db`, or stop local Postgres (e.g. `brew services stop postgresql@16`).",
      );
    }

    hints.push("Host-side npm scripts read ../.env (not .env.local).");

    throw new Error(
      `Cannot connect to database.\n  DATABASE_URL=${databaseUrl}\n  ${detail}${causeMessage ? `\n  ${causeMessage}` : ""}\n\n${hints.join("\n  ")}`,
    );
  }
}
