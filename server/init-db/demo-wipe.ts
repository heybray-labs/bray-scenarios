/**
 * Shell entrypoint for `npm run db:demo-wipe`. Removes demo-prefixed scenarios,
 * users, attempts, and cover media only — leaves all other data untouched.
 */
import { pathToFileURL } from "url";
import { createLogger } from "@heybray/server-kit";
import { wipeDemo as wipeDemoImpl } from "@heybray/scenarios-server";
import { pool } from "../db.ts";

const log = createLogger("demo-wipe");

export async function demoWipe() {
  await wipeDemoImpl();
  console.log("\nDemo data removed. Settings, non-demo content, and other users are unchanged.\n");
}

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  demoWipe()
    .then(() => pool.end())
    .catch((err) => {
      log.error("Demo wipe failed", err instanceof Error ? err : undefined);
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
