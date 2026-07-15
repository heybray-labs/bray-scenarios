// drizzle-kit needs a concrete module path (not just a glob) to pick up table
// definitions that live inside published @heybray/* packages, since those
// packages ship pre-built dist/ output rather than raw .ts source that a glob
// can walk cleanly. This file exists purely so drizzle.config.ts has
// something unambiguous to point at — it is never imported by app code
// (server/db.ts composes the same tables directly from each package for
// runtime use).
//
// content_classification_links is intentionally re-exported by
// @heybray/gamification/schema (for its own FK typing) as well as defined by
// @heybray/taxonomy/schema. Only import it once here — importing both would
// make drizzle-kit see the same table under two module paths and prompt for
// a rename resolution.
export { mediaAssets } from "@heybray/media/schema";
export { users, roles, teams, userIdentities, authExchangeCodes } from "@heybray/identity/schema";
export { classificationDimensions, classificationOptions, contentClassificationLinks } from "@heybray/taxonomy/schema";
export { rewardTiers, userContentTierAwards, activityLog, gamificationContent, pointTransactions } from "@heybray/gamification/schema";
