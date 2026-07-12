export * from "./users.ts";
export * from "./roles.ts";
export * from "./teams.ts";
export * from "./user-identities.ts";
export * from "./auth-exchange-codes.ts";
export * from "./types.ts";

// Disambiguate names declared both by the zod-derived schemas (users.ts) and
// the shared API types (types.ts): the shared API types are authoritative.
export type { LoginCredentials, SetupAdminCredentials } from "./types.ts";

import { users } from "./users.ts";
import { teams } from "./teams.ts";
import { roles } from "./roles.ts";

/**
 * Identity tables contributed to the app's composed drizzle schema. Matches the
 * set previously registered in server/db.ts (users, teams, roles).
 */
export const identitySchema = { users, teams, roles };
