// tsc only compiles .ts/.cts files; the plain HTML/JS renderer assets
// need to be copied into dist alongside the compiled main/preload output.

import { cpSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const appDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

cpSync(path.join(appDir, "src", "renderer"), path.join(appDir, "dist", "renderer"), {
  recursive: true,
  filter: (src) => !src.endsWith(".ts"),
});
