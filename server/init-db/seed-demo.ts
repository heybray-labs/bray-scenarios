/**
 * Shell entrypoint for `npm run db:seed-demo`. The seed logic lives in
 * @heybray/scenarios-server; this wrapper supplies repo-root paths the package
 * cannot resolve once published to node_modules.
 */
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { createLogger } from "@heybray/server-kit";
import { seedDemo as seedDemoImpl } from "@heybray/scenarios-server";
import { pool } from "../db.ts";

const log = createLogger("seed-demo");

const EXAMPLES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../examples",
);

export async function seedDemo() {
  return seedDemoImpl({ examplesDir: EXAMPLES_DIR });
}

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
