import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { roleplays } from "./roleplay-core.ts";

export const classificationDimensions = pgTable(
  "classification_dimensions",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    cardinality: text("cardinality").notNull().default("single"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
);

export const classificationOptions = pgTable(
  "classification_options",
  {
    id: serial("id").primaryKey(),
    dimensionId: integer("dimension_id")
      .notNull()
      .references(() => classificationDimensions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    color: text("color"),
    icon: text("icon"),
  },
  (table) => [uniqueIndex("classification_options_dimension_slug").on(table.dimensionId, table.slug)],
);

export const roleplayClassificationLinks = pgTable(
  "roleplay_classification_links",
  {
    roleplayId: integer("roleplay_id")
      .notNull()
      .references(() => roleplays.id, { onDelete: "cascade" }),
    optionId: integer("option_id")
      .notNull()
      .references(() => classificationOptions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleplayId, table.optionId] })],
);

export type ClassificationDimension = typeof classificationDimensions.$inferSelect;
export type ClassificationOption = typeof classificationOptions.$inferSelect;
export type RoleplayClassificationLink = typeof roleplayClassificationLinks.$inferSelect;

export type ClassificationOptionSummary = {
  id: number;
  slug: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  color: string;
  icon: string;
};

export type ClassificationOptionRef = {
  slug: string;
  label: string;
  color: string;
  icon: string;
};

export type RoleplayClassifications = {
  category: ClassificationOptionRef | null;
  audienceLevel: ClassificationOptionRef | null;
  duration: ClassificationOptionRef | null;
  tags: ClassificationOptionRef[];
};

export type ClassificationDimensionWithOptions = {
  id: number;
  slug: string;
  name: string;
  cardinality: string;
  sortOrder: number;
  options: ClassificationOptionSummary[];
};

export type RoleplayClassificationInput = {
  category?: string | null;
  audienceLevel?: string | null;
  duration?: string | null;
  tags?: string[];
};

export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type MissingImportClassificationOption = {
  dimensionSlug: string;
  dimensionName: string;
  slug: string;
  suggestedLabel: string;
};

/** Shown in import confirmation — user chooses whether to add these. */
export const IMPORT_PROMPT_DIMENSIONS = ["category", "audience_level", "duration"] as const;

/** Created automatically during import without prompting. */
export const IMPORT_AUTO_DIMENSIONS = ["tags"] as const;
