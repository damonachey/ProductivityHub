import http from "node:http";
import {
  requireEnv,
  getServiceTokens,
  saveServiceTokens,
  deleteServiceTokens,
  type OAuthTokens,
} from "@productivityhub/core";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

const TOKEN_SECTION = "googleMailTokens";

function getClientCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  };
}

function readTokens(): OAuthTokens | null {
  return getServiceTokens(TOKEN_SECTION);
}

function saveTokens(tokens: OAuthTokens): void {
  saveServiceTokens(TOKEN_SECTION, tokens);
}

export function isAuthenticated(): boolean {
  return readTokens() !== null;
}

export function disconnect(): void {
  deleteServiceTokens(TOKEN_SECTION);
}

// Runs the standard "installed app" OAuth loopback flow: starts a local
// server on 127.0.0.1, hands the caller the consent URL to open in a real
// browser (opening a browser is platform-specific, so that's the caller's
// job - e.g. Electron's shell.openExternal), and resolves once Google
// redirects back to the loopback server with an authorization code, which
// is then exchanged for tokens.
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
          : "<html><body>ProductivityHub is connected to Gmail. You can close this tab.</body></html>",
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
    throw new Error("Not connected to Gmail");
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
  const updated: OAuthTokens = {
    refreshToken: tokens.refreshToken,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveTokens(updated);
  return updated.accessToken;
}

async function gmailFetch(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getAccessToken();
  return fetch(`${GMAIL_API_BASE}${pathAndQuery}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export interface GmailThreadSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string | null;
  unread: boolean;
  messageCount: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  labelIds?: string[];
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function listInboxThreads(maxResults = 20): Promise<GmailThreadSummary[]> {
  const listResponse = await gmailFetch(`/threads?labelIds=INBOX&maxResults=${maxResults}`);
  if (!listResponse.ok) {
    throw new Error(`HTTP ${listResponse.status}`);
  }
  const listData = (await listResponse.json()) as { threads?: { id: string }[] };
  const threadIds = listData.threads ?? [];

  const threads = await Promise.all(
    threadIds.map(async ({ id }) => {
      const response = await gmailFetch(
        `/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      );
      if (!response.ok) return null;
      const thread = (await response.json()) as GmailThread;
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (!lastMessage) return null;
      const unread = thread.messages.some((message) => message.labelIds?.includes("UNREAD"));

      return {
        id: thread.id,
        subject: headerValue(lastMessage.payload?.headers, "Subject") || "(no subject)",
        from: headerValue(lastMessage.payload?.headers, "From"),
        snippet: lastMessage.snippet ?? "",
        date: headerValue(lastMessage.payload?.headers, "Date") || null,
        unread,
        messageCount: thread.messages.length,
      } satisfies GmailThreadSummary;
    }),
  );

  return threads.filter((thread): thread is GmailThreadSummary => thread !== null);
}

export async function markThreadRead(threadId: string): Promise<void> {
  const response = await gmailFetch(`/threads/${threadId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function markThreadUnread(threadId: string): Promise<void> {
  const response = await gmailFetch(`/threads/${threadId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addLabelIds: ["UNREAD"] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function archiveThread(threadId: string): Promise<void> {
  const response = await gmailFetch(`/threads/${threadId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

// Moves the thread to Trash (recoverable for 30 days), matching the trash-
// can icon in Gmail's own UI - not a permanent, unrecoverable delete.
export async function trashThread(threadId: string): Promise<void> {
  const response = await gmailFetch(`/threads/${threadId}/trash`, { method: "POST" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
