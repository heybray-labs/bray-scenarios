import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const authExchangeCodes = pgTable("auth_exchange_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
