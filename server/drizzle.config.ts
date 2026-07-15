import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL not found. Please configure DATABASE_URL environment variable.");
}

export default defineConfig({
  out: "./drizzle",
  schema: ["../shared/schemas/**/*.ts", "./drizzle-packages-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
