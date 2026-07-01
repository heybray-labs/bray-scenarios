import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import only direct dependencies to avoid circular imports
import { tenants } from "./tenants.ts";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstName: text("first_name"),
  password: text("password"),
  roleId: integer("role_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isSuspended: boolean("is_suspended").notNull().default(false),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  lockedUntil: timestamp("locked_until"),
  approvalStatus: text("approval_status").notNull().default("approved"), // "pending", "approved", "rejected"
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  // 2FA fields
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorMethod: text("two_factor_method"), // 'totp' or 'email'
  totpSecret: text("totp_secret"), // Encrypted TOTP secret
  emailOtpCode: text("email_otp_code"), // Temporary email OTP code
  emailOtpExpiry: timestamp("email_otp_expiry"), // When email OTP expires
  twoFactorBackupUsed: integer("two_factor_backup_used").notNull().default(0), // Count of backup codes used
  // Tenant role fields (replaces tenant_users junction table)
  isTenantAdmin: boolean("is_tenant_admin").notNull().default(false),
  tenantRole: text("tenant_role").default("member"), // 'owner', 'admin', 'member', etc.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  emailTenantIdx: uniqueIndex("users_email_tenant_idx").on(table.email, table.tenantId),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const updateUserSchema = insertUserSchema.partial().extend({
  id: z.number(),
});

// Additional schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const setupAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// User relations - will be defined in centralized relations file  
// to avoid circular import dependencies

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "user"]),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type SetupAdminCredentials = z.infer<typeof setupAdminSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type AdminCreateUser = z.infer<typeof adminCreateUserSchema>;
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;