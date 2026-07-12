export * from "./media-assets.ts";

import { mediaAssets } from "./media-assets.ts";

/**
 * server-kit tables contributed to the app's composed drizzle schema. Matches
 * the media_assets table previously registered directly in server/db.ts.
 */
export const serverKitSchema = { mediaAssets };
