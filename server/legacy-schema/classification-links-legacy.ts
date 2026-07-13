// Legacy table, unread since Phase 2. Registered in db.ts only so drizzle's
// runtime schema knows it exists. Dropped in migration 0010 (future release).
// Deliberately OUTSIDE the drizzle.config.ts glob — the canonical
// content_classification_links definition lives in @heybray/taxonomy/schema.
import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { classificationOptions } from "@heybray/taxonomy/schema";
import { roleplays } from "../../shared/schemas/roleplay-core.ts";

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

export type RoleplayClassificationLink = typeof roleplayClassificationLinks.$inferSelect;
