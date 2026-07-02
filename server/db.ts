import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
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
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "../shared/schemas/agent/roleplay-app-config.ts";

const schema = {
  users,
  roles,
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export { pool };
