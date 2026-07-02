import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  isGlobal: boolean("is_global").notNull().default(false),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
});

export const updateRoleSchema = insertRoleSchema.partial();

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
