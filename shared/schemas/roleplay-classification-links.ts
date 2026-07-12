import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { classificationOptions } from "@heybray/taxonomy/schema";
import { roleplays } from "./roleplay-core.ts";

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
