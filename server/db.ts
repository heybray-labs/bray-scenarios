import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { tenants } from "../shared/schemas/tenants.ts";
import { users } from "../shared/schemas/users.ts";
import { roles } from "../shared/schemas/roles.ts";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
} from "../shared/schemas/roleplay-core.ts";
import {
  roleplayTenantConfig,
  roleplayTenantProviderKeys,
  roleplayTenantPersonaModels,
  roleplayTenantGraderModels,
} from "../shared/schemas/agent/roleplay-tenant-config.ts";

const schema = {
  tenants,
  users,
  roles,
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  roleplayTenantConfig,
  roleplayTenantProviderKeys,
  roleplayTenantPersonaModels,
  roleplayTenantGraderModels,
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { pool };
