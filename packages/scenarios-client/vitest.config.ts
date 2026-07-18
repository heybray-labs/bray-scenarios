import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.tsx"],
    server: {
      deps: {
        inline: ["@heybray/gamification-react", "@heybray/react"],
      },
    },
  },
});
