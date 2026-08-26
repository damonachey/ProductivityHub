import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Single per-user config directory shared by the CLI and desktop app,
// independent of the repo/install location (so it still works for a
// distributed portable exe, which has no "repo" to resolve paths against).
export const CONFIG_DIR = path.join(os.homedir(), ".productivityhub");

const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface StoredConfig {
  [key: string]: string | undefined;
}

let cachedConfig: StoredConfig | null = null;

function readStoredConfig(): StoredConfig {
  if (!cachedConfig) {
    try {
      cachedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as StoredConfig;
    } catch {
      cachedConfig = {};
    }
  }
  return cachedConfig;
}

export function requireEnv(name: string): string {
  const value = process.env[name] ?? readStoredConfig()[name];
  if (!value) {
    throw new Error(
      `Missing required configuration value: ${name}. Set it in ${CONFIG_FILE} or as an environment variable.`,
    );
  }
  return value;
}
