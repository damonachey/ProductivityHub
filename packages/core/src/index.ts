import { SECRETS_FILE, getApiConfigValue } from "./secrets.js";

export { CONFIG_DIR } from "./paths.js";
export * from "./jsonFile.js";
export * from "./secrets.js";

export function requireEnv(name: string): string {
  const value = process.env[name] ?? getApiConfigValue(name);
  if (!value) {
    throw new Error(
      `Missing required configuration value: ${name}. Set it in ${SECRETS_FILE} or as an environment variable.`,
    );
  }
  return value;
}
