/**
 * Shell entrypoint for `npm run db:demo-seed`. The seed logic lives in
 * @heybray/scenarios-server; this wrapper exists so the shell can invoke it
 * with the app's database pool.
 */
import { pathToFileURL } from "url";
import { createLogger } from "@heybray/server-kit";
import { seedDemo as seedDemoImpl } from "@heybray/scenarios-server";
import { pool } from "../db.ts";

const log = createLogger("demo-seed");

export async function demoSeed() {
  return seedDemoImpl();
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  demoSeed()
    .then(() => pool.end())
    .catch((err) => {
      log.error("Demo seed failed", err instanceof Error ? err : undefined);
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
