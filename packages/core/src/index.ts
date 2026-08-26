import { config } from "dotenv";
import path from "node:path";
import url from "node:url";

// Resolves relative to this module's own location (packages/core/dist/index.js)
// rather than process.cwd(), so .env loads correctly no matter where the
// caller (ph.cmd, phdesktop.cmd, a bundled build, etc.) was invoked from.
const repoRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

config({ path: path.join(repoRoot, ".env") });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
