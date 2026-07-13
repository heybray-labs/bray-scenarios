import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { desc, eq, inArray } from "drizzle-orm";
import { db, createLogger } from "@heybray/server-kit";
import { mediaAssets, type MediaAsset } from "./schema/media-assets.ts";

const log = createLogger("media");

/**
 * Seam for domains that reference media assets (e.g. an app's content covers).
 * The media package owns storage but must not know about app tables, so usage
 * counting and reference detachment are delegated to an app-registered implementation.
 */
export interface MediaUsageHook {
  /** Number of times each media id is referenced, keyed by media id. */
  countUsages(mediaIds: number[]): Promise<Map<number, number>>;
  /** Detach any references to the media id before it is deleted. */
  onMediaDeleted(mediaId: number): Promise<void>;
}

const noopUsageHook: MediaUsageHook = {
  async countUsages() {
    return new Map();
  },
  async onMediaDeleted() {
    /* no references to detach by default */
  },
};

export const MEDIA_MAX_BYTES = 500 * 1024;
export const MEDIA_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

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

export function mediaPublicUrl(id: number): string {
  return `/api/media/${id}`;
}

export function withCoverImageUrl<T extends { coverImageMediaId?: number | null }>(
  row: T,
): T & { coverImageUrl: string | null } {
  return {
    ...row,
    coverImageUrl: row.coverImageMediaId != null ? mediaPublicUrl(row.coverImageMediaId) : null,
  };
}

function validateMimeAndSize(mimeType: string, sizeBytes: number): void {
  if (!MEDIA_ALLOWED_MIME.has(mimeType)) {
    throw new MediaValidationError(
      "Unsupported image type. Use JPEG, PNG, or WebP.",
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MEDIA_MAX_BYTES) {
    throw new MediaValidationError(
      `Image must be at most ${MEDIA_MAX_BYTES / 1024} KB.`,
    );
  }
}

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export class MediaNotFoundError extends Error {
  constructor(message = "Media not found") {
    super(message);
    this.name = "MediaNotFoundError";
  }
}

export type MediaAssetWithUsage = MediaAsset & { usageCount: number };

export class MediaService {
  constructor(private usageHook: MediaUsageHook = noopUsageHook) {}

  setUsageHook(hook: MediaUsageHook): void {
    this.usageHook = hook;
  }

  async listWithUsage(): Promise<MediaAssetWithUsage[]> {
    const rows = await db
      .select()
      .from(mediaAssets)
      .orderBy(desc(mediaAssets.createdAt));

    const usage = await this.usageHook.countUsages(rows.map((r) => r.id));

    return rows.map((r) => ({
      ...r,
      usageCount: usage.get(r.id) ?? 0,
    }));
  }

  async getById(id: number): Promise<MediaAsset | null> {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    return row ?? null;
  }

  async getByIds(ids: number[]): Promise<MediaAsset[]> {
    if (!ids.length) return [];
    return db.select().from(mediaAssets).where(inArray(mediaAssets.id, ids));
  }

  async createFromBuffer(
    buffer: Buffer,
    options: {
      originalFilename: string;
      mimeType: string;
      createdBy: number;
      storageKey?: string;
    },
  ): Promise<MediaAsset> {
    validateMimeAndSize(options.mimeType, buffer.length);

    const dir = ensureMediaDir();
    const ext = MIME_TO_EXT[options.mimeType] ?? "";
    const storageKey = options.storageKey ?? `${randomUUID()}${ext}`;
    const filePath = path.join(dir, storageKey);

    await fs.writeFile(filePath, buffer);

    try {
      const [created] = await db
        .insert(mediaAssets)
        .values({
          originalFilename: options.originalFilename.slice(0, 255) || `image${ext}`,
          mimeType: options.mimeType,
          sizeBytes: buffer.length,
          storageKey,
          createdBy: options.createdBy,
        })
        .returning();
      return created;
    } catch (error) {
      await fs.unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  resolvePath(asset: MediaAsset): string {
    return path.join(getMediaDir(), asset.storageKey);
  }

  openReadStream(asset: MediaAsset) {
    const filePath = this.resolvePath(asset);
    if (!existsSync(filePath)) {
      throw new MediaNotFoundError("Media file missing on disk");
    }
    return createReadStream(filePath);
  }

  async readFile(asset: MediaAsset): Promise<Buffer> {
    const filePath = this.resolvePath(asset);
    try {
      return await fs.readFile(filePath);
    } catch {
      throw new MediaNotFoundError("Media file missing on disk");
    }
  }

  async delete(id: number): Promise<{ usageCount: number }> {
    const asset = await this.getById(id);
    if (!asset) throw new MediaNotFoundError();

    const usage = await this.usageHook.countUsages([id]);
    const usageCount = usage.get(id) ?? 0;

    await this.usageHook.onMediaDeleted(id);

    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));

    const filePath = this.resolvePath(asset);
    await fs.unlink(filePath).catch((err) => {
      log.warn("Failed to delete media file", {
        storageKey: asset.storageKey,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return { usageCount };
  }

  async assertExists(id: number | null | undefined): Promise<void> {
    if (id == null) return;
    const asset = await this.getById(id);
    if (!asset) {
      throw new MediaValidationError("Cover image not found in media library");
    }
  }
}

export const mediaService = new MediaService();

/** Register the app-backed media usage implementation on the shared singleton. */
export function setMediaUsageHook(hook: MediaUsageHook): void {
  mediaService.setUsageHook(hook);
}
