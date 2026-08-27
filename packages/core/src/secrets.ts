import path from "node:path";
import { CONFIG_DIR } from "./paths.js";
import { readJson, updateJson } from "./jsonFile.js";

export const SECRETS_FILE = path.join(CONFIG_DIR, "secrets.json");

export interface OAuthTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
}

export type TokenSection = "googleMailTokens" | "googleTasksTokens" | "googleCalendarTokens";

// Flat API-key fields (matching the hand-edited shape documented in the
// README) plus one OAuth token blob per Google service.
interface SecretsFile {
  [key: string]: unknown;
  googleMailTokens?: OAuthTokens;
  googleTasksTokens?: OAuthTokens;
  googleCalendarTokens?: OAuthTokens;
}

export function getApiConfigValue(name: string): string | undefined {
  const value = readJson<SecretsFile>(SECRETS_FILE, {})[name];
  return typeof value === "string" ? value : undefined;
}

export function getServiceTokens(section: TokenSection): OAuthTokens | null {
  return readJson<SecretsFile>(SECRETS_FILE, {})[section] ?? null;
}

export function saveServiceTokens(section: TokenSection, tokens: OAuthTokens): void {
  updateJson<SecretsFile>(SECRETS_FILE, {}, (secrets) => {
    secrets[section] = tokens;
  });
}

export function deleteServiceTokens(section: TokenSection): void {
  updateJson<SecretsFile>(SECRETS_FILE, {}, (secrets) => {
    delete secrets[section];
  });
}
