import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const apiPort = process.env.VITE_API_PORT || process.env.PORT || "3001";
const devPort = parseInt(process.env.VITE_PORT || "5173", 10);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "..", "shared"),
      "@assets": path.resolve(import.meta.dirname, "src", "assets"),
    },
  },
  // esbuild 0.28+ treats Safari <14.1 as lacking destructuring support.
  // Vite 6's default target includes safari14, which fails the build.
  build: {
    target: "es2022",
  },
  server: {
    port: devPort,
    allowedHosts: ["reliable-slouchy-scariness.ngrok-free.dev"],
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
