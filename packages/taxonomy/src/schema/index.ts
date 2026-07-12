export * from "./classifications.ts";
export * from "./display.ts";

// Both classifications.ts and display.ts declare a ClassificationOptionRef; the
// classifications.ts variant (non-null color/icon) is the authoritative one used
// by RoleplayClassifications and the service.
export type { ClassificationOptionRef } from "./classifications.ts";

import { classificationDimensions, classificationOptions } from "./classifications.ts";

/**
 * Taxonomy tables contributed to the app's composed drizzle schema. Matches the
 * set previously registered in server/db.ts (dimensions + options). The
 * roleplay↔option join table stays app-side and is registered there.
 */
export const taxonomySchema = { classificationDimensions, classificationOptions };
