import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// v1: users belong to at most one team via users.teamId (not a join table).
// Migrate to team_members if multi-team membership is needed later.
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  managerId: integer("manager_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  managerId: z.number().int().positive().nullable().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  managerId: z.number().int().positive().nullable().optional(),
});

export const setTeamMembersSchema = z.object({
  memberIds: z.array(z.number().int().positive()),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type CreateTeam = z.infer<typeof createTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type SetTeamMembers = z.infer<typeof setTeamMembersSchema>;
