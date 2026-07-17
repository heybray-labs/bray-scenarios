import { createDb, setDatabase } from "@heybray/server-kit";
import { setMediaUsageHook } from "@heybray/media";
import { mediaSchema } from "@heybray/media/schema";
import { identitySchema } from "@heybray/identity/schema";
import { taxonomySchema } from "@heybray/taxonomy";
import { gamificationSchema } from "@heybray/gamification";
import { scenariosSchema, roleplayMediaUsage } from "@heybray/scenarios-server";

const schema = {
  ...mediaSchema,
  ...identitySchema,
  ...taxonomySchema,
  ...gamificationSchema,
  ...scenariosSchema,
};

const { db, pool } = createDb(schema);
setDatabase(db);
setMediaUsageHook(roleplayMediaUsage);
export { db, pool };
