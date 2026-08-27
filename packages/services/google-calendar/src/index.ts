import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, requireEnv } from "@productivityhub/core";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

const TOKENS_FILE = path.join(CONFIG_DIR, "google-calendar-tokens.json");

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

// Same "installed app" OAuth loopback flow as @productivityhub/google-mail
// and @productivityhub/google-tasks - own token file and scope, since it's
// a separate consent grant despite sharing the Google Cloud OAuth client.
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
          : "<html><body>ProductivityHub is connected to Google Calendar. You can close this tab.</body></html>",
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
    throw new Error("Not connected to Google Calendar");
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

export interface CalendarEvent {
  id: string;
  title: string;
  location: string | null;
  htmlLink: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface RawEventDateTime {
  date?: string;
  dateTime?: string;
}

interface RawEvent {
  id: string;
  summary?: string;
  location?: string;
  htmlLink: string;
  start: RawEventDateTime;
  end: RawEventDateTime;
  status?: string;
}

async function fetchEvents(params: Record<string, string>): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken();
  const url = new URL(CALENDAR_API_BASE);
  url.search = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    ...params,
  }).toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = (await response.json()) as { items?: RawEvent[] };
  return (data.items ?? [])
    .filter((event) => event.status !== "cancelled")
    .map((event) => {
      const allDay = Boolean(event.start.date);
      return {
        id: event.id,
        title: event.summary ?? "(no title)",
        location: event.location ?? null,
        htmlLink: event.htmlLink,
        start: event.start.dateTime ?? event.start.date ?? "",
        end: event.end.dateTime ?? event.end.date ?? "",
        allDay,
      };
    });
}

export async function listUpcomingEvents(maxResults = 20): Promise<CalendarEvent[]> {
  return fetchEvents({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
  });
}

// Grid view needs every event in a fixed calendar range (not just the next N
// upcoming), so it queries by [timeMin, timeMax) instead of maxResults.
export async function listEventsInRange(
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  return fetchEvents({ timeMin, timeMax, maxResults: "2500" });
}
