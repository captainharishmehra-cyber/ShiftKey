import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "/static/react/",
  build: {
    outDir: resolve(projectDir, "../app/static/react"),
    emptyOutDir: true,
    sourcemap: true
  }
});