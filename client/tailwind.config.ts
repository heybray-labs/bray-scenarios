import type { Config } from "tailwindcss";
import { uiPreset } from "@heybray/ui/tailwind-preset";

export default {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../packages/scenarios-client/src/**/*.{js,jsx,ts,tsx}",
    "../node_modules/@heybray/scenarios-client/src/**/*.{js,jsx,ts,tsx}",
    "../node_modules/@heybray/ui/dist/**/*.{js,js.map}",
    "../node_modules/@heybray/react/dist/**/*.{js,js.map}",
    "../node_modules/@heybray/gamification-react/dist/**/*.{js,js.map}",
  ],
} satisfies Config;
