import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import only direct dependencies to avoid circular imports
import { tenants } from "./tenants.ts";

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  isGlobal: boolean("is_global").notNull().default(false),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
});

export const updateRoleSchema = insertRoleSchema.partial();

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;

// Role relations - will be defined in centralized relations file
// to avoid circular import dependencies