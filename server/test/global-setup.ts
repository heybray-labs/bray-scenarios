import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function setup() {
  if (process.env.CI || process.env.SKIP_TEST_DOCKER) {
    return;
  }

  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes(":5434/")) {
    return;
  }

  try {
    execSync("docker compose -f docker-compose.test.yml up -d --wait", {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch {
    console.warn(
      "Could not start docker-compose.test.yml — ensure Docker is running or set DATABASE_URL / SKIP_TEST_DOCKER=1",
    );
  }
}

export async function teardown() {
  if (process.env.CI || process.env.SKIP_TEST_DOCKER || process.env.KEEP_TEST_DB) {
    return;
  }

  try {
    execSync("docker compose -f docker-compose.test.yml down -v --remove-orphans", {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch {
    // ignore teardown errors
  }
}
