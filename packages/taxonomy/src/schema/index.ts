export * from "./classifications.ts";
export * from "./display.ts";
export * from "./content-links.ts";

// Both classifications.ts and display.ts declare a ClassificationOptionRef; the
// classifications.ts variant (non-null color/icon) is the authoritative one used
// by RoleplayClassifications and the service.
export type { ClassificationOptionRef } from "./classifications.ts";

import { classificationDimensions, classificationOptions } from "./classifications.ts";
import { contentClassificationLinks } from "./content-links.ts";

/**
 * Taxonomy tables contributed to the app's composed drizzle schema. Taxonomy now
 * owns the content↔option join table (content_classification_links) outright.
 */
export const taxonomySchema = {
  classificationDimensions,
  classificationOptions,
  contentClassificationLinks,
};
