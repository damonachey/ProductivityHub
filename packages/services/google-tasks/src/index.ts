import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, requireEnv } from "@productivityhub/core";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
const SCOPE = "https://www.googleapis.com/auth/tasks";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

const TOKENS_FILE = path.join(CONFIG_DIR, "google-tasks-tokens.json");

interface StoredTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  };
}

function readTokens(): StoredTokens | null {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8")) as StoredTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

export function isAuthenticated(): boolean {
  return readTokens() !== null;
}

export function disconnect(): void {
  try {
    fs.unlinkSync(TOKENS_FILE);
  } catch {
    // already disconnected
  }
}

// Same "installed app" OAuth loopback flow as @productivityhub/google-mail,
// but with its own token file and scope, since it's a separate consent
// grant even though both use the same Google Cloud OAuth client.
export async function authenticate(openUrl: (url: string) => void): Promise<void> {
  const { clientId, clientSecret } = getClientCredentials();

  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to start local OAuth callback server");
  }
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString();

  const codePromise = new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const requestUrl = new URL(req.url ?? "/", redirectUri);
      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        error
          ? "<html><body>Authorization failed. You can close this tab.</body></html>"
          : "<html><body>ProductivityHub is connected to Google Tasks. You can close this tab.</body></html>",
      );
      if (error) reject(new Error(error));
      else if (code) resolve(code);
    });
  });

  const timeoutPromise = new Promise<string>((_resolve, reject) => {
    setTimeout(() => reject(new Error("Timed out waiting for Google sign-in")), AUTH_TIMEOUT_MS);
  });

  openUrl(authUrl.toString());

  try {
    const code = await Promise.race([codePromise, timeoutPromise]);

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: HTTP ${tokenResponse.status}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!tokenData.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Revoke access at https://myaccount.google.com/permissions and try connecting again.",
      );
    }

    saveTokens({
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    });
  } finally {
    server.close();
  }
}

async function getAccessToken(): Promise<string> {
  const tokens = readTokens();
  if (!tokens) {
    throw new Error("Not connected to Google Tasks");
  }
  if (tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken;
  }

  const { clientId, clientSecret } = getClientCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed: HTTP ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  const updated: StoredTokens = {
    refreshToken: tokens.refreshToken,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(updated);
  return updated.accessToken;
}

async function tasksFetch(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getAccessToken();
  return fetch(`${TASKS_API_BASE}${pathAndQuery}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export interface GoogleTask {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;
  status: "needsAction" | "completed";
}

interface RawTask {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: string;
}

function toGoogleTask(task: RawTask): GoogleTask {
  return {
    id: task.id,
    title: task.title ?? "(no title)",
    notes: task.notes ?? null,
    due: task.due ?? null,
    status: task.status === "completed" ? "completed" : "needsAction",
  };
}

export async function listTasks(): Promise<GoogleTask[]> {
  const response = await tasksFetch("?showCompleted=true&showHidden=true&maxResults=100");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { items?: RawTask[] };
  return (data.items ?? []).map(toGoogleTask);
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  due?: string;
}

// Google Tasks' `due` field only ever stores a calendar date - the time
// portion of any timestamp is discarded server-side and can't be read back,
// so `due` here is a plain "YYYY-MM-DD" string, not a date+time.
export async function createTask(input: CreateTaskInput): Promise<GoogleTask> {
  const response = await tasksFetch("", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      notes: input.notes || undefined,
      due: input.due ? `${input.due}T00:00:00.000Z` : undefined,
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const task = (await response.json()) as RawTask;
  return toGoogleTask(task);
}

export async function setTaskStatus(
  taskId: string,
  status: "needsAction" | "completed",
): Promise<void> {
  const response = await tasksFetch(`/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function deleteTask(taskId: string): Promise<void> {
  const response = await tasksFetch(`/${taskId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
