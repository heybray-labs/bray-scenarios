/**
 * Shell entrypoint for `npm run db:seed-demo`. The seed logic itself moved into
 * @heybray/scenarios-server during the Phase 6A extraction; this thin wrapper
 * re-exports `seedDemo` (so the golden test keeps its historical import path)
 * and owns the CLI direct-run behaviour that closes the shell's pg pool.
 */
import { pathToFileURL } from "url";
import { createLogger } from "@heybray/server-kit";
import { seedDemo } from "@heybray/scenarios-server";
import { pool } from "../db.ts";

export { seedDemo };

const log = createLogger("seed-demo");

// Only run + close the pool when invoked directly as a script (npm run db:seed-demo).
// When imported (e.g. by the gamification golden test), callers control the pool.
const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedDemo()
    .then(() => pool.end())
    .catch((err) => {
      log.error("Demo seed failed", err instanceof Error ? err : undefined);
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
