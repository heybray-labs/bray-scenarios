import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
    port: 5173,
    allowedHosts: ["reliable-slouchy-scariness.ngrok-free.dev"],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
