import fs from "fs/promises";
import path from "path";
import { createReadStream, existsSync, mkdirSync } from "fs";

export function getMediaDir(): string {
  return process.env.MEDIA_DIR || path.resolve(process.cwd(), "data/media");
}

export function ensureMediaDir(): string {
  const dir = getMediaDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Extension seam for where media bytes live. The OSS default
 * (FilesystemStorageProvider) wraps the exact current fs.* calls this app
 * has always used; a Phase 6 enterprise package can call setStorageProvider()
 * to swap in S3 (or similar) without touching media.service.ts's callers.
 */
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  getStream(key: string): NodeJS.ReadableStream;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Thrown by getStream() when the keyed file doesn't exist on disk. */
export class StorageNotFoundError extends Error {
  constructor(message = "Storage object not found") {
    super(message);
    this.name = "StorageNotFoundError";
  }
}

export class FilesystemStorageProvider implements StorageProvider {
  private resolvePath(key: string): string {
    return path.join(getMediaDir(), key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    ensureMediaDir();
    await fs.writeFile(this.resolvePath(key), data);
  }

  getStream(key: string): NodeJS.ReadableStream {
    const filePath = this.resolvePath(key);
    if (!existsSync(filePath)) {
      throw new StorageNotFoundError(`No file at key: ${key}`);
    }
    return createReadStream(filePath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.resolvePath(key));
  }
}

let currentProvider: StorageProvider = new FilesystemStorageProvider();

export function setStorageProvider(provider: StorageProvider): void {
  currentProvider = provider;
}

export function getStorageProvider(): StorageProvider {
  return currentProvider;
}
