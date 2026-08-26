import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import url from "node:url";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

// base: "./" is required so the built index.html references assets with
// relative paths — Electron loads it via file://, which has no server root.
export default defineConfig({
  root: path.join(dirname, "src", "renderer"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.join(dirname, "dist", "renderer"),
    emptyOutDir: true,
  },
});
