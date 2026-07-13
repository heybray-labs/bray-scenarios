import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { classificationOptions } from "./classifications.ts";

/**
 * Content-polymorphic join between classification options and any consuming
 * content. Taxonomy owns this table outright (Phase 2). `content_id` carries no
 * `.references()` — the binding FK into the app's content table is the app's own
 * migration (0009_scenario_binding.sql), because the taxonomy package must not
 * know any single app's content table.
 */
export const contentClassificationLinks = pgTable(
  "content_classification_links",
  {
    contentType: text("content_type").notNull().default("scenario"),
    contentId: integer("content_id").notNull(),
    optionId: integer("option_id")
      .notNull()
      .references(() => classificationOptions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contentType, table.contentId, table.optionId] }),
  ],
);

export type ContentClassificationLink = typeof contentClassificationLinks.$inferSelect;
