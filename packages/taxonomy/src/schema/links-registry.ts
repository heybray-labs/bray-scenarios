import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { classificationOptions } from "./classifications.ts";

/**
 * The join table between classification options and the consuming domain's
 * entities lives app-side (it carries the FK to the app's own table and is
 * renamed/generalized in a later phase). This default definition serves as the
 * type anchor and standalone fallback; the app injects its concrete table via
 * setClassificationLinks() at startup so the service issues queries against it.
 */
const defaultClassificationLinks = pgTable(
  "roleplay_classification_links",
  {
    roleplayId: integer("roleplay_id").notNull(),
    optionId: integer("option_id")
      .notNull()
      .references(() => classificationOptions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleplayId, table.optionId] })],
);

export type ClassificationLinksTable = typeof defaultClassificationLinks;

export let classificationLinks: ClassificationLinksTable = defaultClassificationLinks;

export function setClassificationLinks(table: ClassificationLinksTable): void {
  classificationLinks = table;
}
