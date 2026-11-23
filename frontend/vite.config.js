import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/static/react/",
  build: {
    outDir: resolve(__dirname, "../app/static/react"),
    emptyOutDir: true,
    sourcemap: true
  }
});