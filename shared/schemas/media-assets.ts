import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;
