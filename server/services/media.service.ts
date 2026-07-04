import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { createReadStream, existsSync, mkdirSync } from "fs";
import { desc, eq, sql, inArray } from "drizzle-orm";
import { db } from "../db.ts";
import { mediaAssets, type MediaAsset } from "../../shared/schemas/media-assets.ts";
import { roleplays } from "../../shared/schemas/roleplay-core.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("media");

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
  async listWithUsage(): Promise<MediaAssetWithUsage[]> {
    const rows = await db
      .select({
        id: mediaAssets.id,
        originalFilename: mediaAssets.originalFilename,
        mimeType: mediaAssets.mimeType,
        sizeBytes: mediaAssets.sizeBytes,
        storageKey: mediaAssets.storageKey,
        createdBy: mediaAssets.createdBy,
        createdAt: mediaAssets.createdAt,
        usageCount: sql<number>`cast(count(${roleplays.id}) as int)`,
      })
      .from(mediaAssets)
      .leftJoin(roleplays, eq(roleplays.coverImageMediaId, mediaAssets.id))
      .groupBy(mediaAssets.id)
      .orderBy(desc(mediaAssets.createdAt));

    return rows.map((r) => ({
      ...r,
      usageCount: Number(r.usageCount) || 0,
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

    const referencing = await db
      .select({ id: roleplays.id })
      .from(roleplays)
      .where(eq(roleplays.coverImageMediaId, id));
    const usageCount = referencing.length;

    await db
      .update(roleplays)
      .set({ coverImageMediaId: null, updatedAt: new Date() })
      .where(eq(roleplays.coverImageMediaId, id));

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
