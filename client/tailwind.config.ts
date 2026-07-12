import type { Config } from "tailwindcss";
import { uiPreset } from "@heybray/ui/tailwind-preset";

export default {
  presets: [uiPreset],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../packages/ui/src/**/*.{ts,tsx}",
    "../packages/react/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
