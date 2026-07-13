import { eq, inArray } from "drizzle-orm";
import type { MediaUsageHook } from "@heybray/media";
import { db } from "./db.ts";
import { roleplays } from "../shared/schemas/roleplay-core.ts";

/**
 * App-side implementation of the media package's MediaUsageHook: roleplay cover images
 * reference media assets via roleplays.coverImageMediaId. This carries the
 * queries that previously lived inside the media service.
 */
export const roleplayMediaUsage: MediaUsageHook = {
  async countUsages(mediaIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (!mediaIds.length) return result;

    const rows = await db
      .select({ mediaId: roleplays.coverImageMediaId })
      .from(roleplays)
      .where(inArray(roleplays.coverImageMediaId, mediaIds));

    for (const row of rows) {
      if (row.mediaId == null) continue;
      result.set(row.mediaId, (result.get(row.mediaId) ?? 0) + 1);
    }
    return result;
  },

  async onMediaDeleted(mediaId: number): Promise<void> {
    await db
      .update(roleplays)
      .set({ coverImageMediaId: null, updatedAt: new Date() })
      .where(eq(roleplays.coverImageMediaId, mediaId));
  },
};
