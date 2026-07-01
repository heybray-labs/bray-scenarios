import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.ts";
import { users } from "./users.ts";

export const userIdentities = pgTable(
  "user_identities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    providerDisplayName: text("provider_display_name"),
    providerEmail: text("provider_email"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    providerUserIdx: uniqueIndex("user_identities_provider_user_idx").on(
      table.provider,
      table.providerUserId,
      table.tenantId,
    ),
  }),
);
