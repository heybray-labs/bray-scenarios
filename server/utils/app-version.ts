import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

let cachedVersion: string | null = null;

export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8")) as {
    version: string;
  };
  cachedVersion = pkg.version;
  return cachedVersion;
}
