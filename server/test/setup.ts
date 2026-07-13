import { beforeAll } from "vitest";
import { initializeDatabase } from "../init-db/init-db.ts";
import { ensureMediaDir } from "@heybray/media";
import { resetMutableData } from "./db.ts";

let databaseReady = false;

export async function ensureTestDatabase(): Promise<void> {
  if (!databaseReady) {
    await initializeDatabase();
    ensureMediaDir();
    databaseReady = true;
  }
  await resetMutableData();
}

beforeAll(async () => {
  await ensureTestDatabase();
});
