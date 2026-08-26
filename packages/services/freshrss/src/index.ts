import { requireEnv } from "@productivityhub/core";

const ITEM_COUNT = 30;

export interface FreshRssItem {
  id: string;
  title: string;
  link: string;
  feedTitle: string;
  publishedAt: string | null;
}

function readConfig(): { baseUrl: string; user: string; password: string } {
  return {
    baseUrl: requireEnv("FRESHRSS_URL").replace(/\/$/, ""),
    user: requireEnv("FRESHRSS_USER"),
    password: requireEnv("FRESHRSS_API_PASSWORD"),
  };
}

// FreshRSS's Google Reader-compatible API: exchange user + API password for
// a bearer token, then use that token to read the unread stream.
async function getAuthToken(): Promise<{ baseUrl: string; token: string }> {
  const { baseUrl, user, password } = readConfig();
  const loginUrl = `${baseUrl}/api/greader.php/accounts/ClientLogin?Email=${encodeURIComponent(user)}&Passwd=${encodeURIComponent(password)}`;

  const response = await fetch(loginUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(`FreshRSS login failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const match = body.match(/Auth=(.+)/);
  if (!match) {
    throw new Error("FreshRSS login response did not include an auth token");
  }

  return { baseUrl, token: match[1].trim() };
}

interface RawStreamItem {
  id: string;
  title?: string;
  published?: number;
  canonical?: { href: string }[];
  alternate?: { href: string }[];
  origin?: { title?: string };
}

interface RawStreamResponse {
  items?: RawStreamItem[];
}

export async function getUnreadItems(): Promise<FreshRssItem[]> {
  const { baseUrl, token } = await getAuthToken();
  const streamUrl =
    `${baseUrl}/api/greader.php/reader/api/0/stream/contents/user/-/state/com.google/reading-list` +
    `?n=${ITEM_COUNT}&xt=user/-/state/com.google/read`;

  const response = await fetch(streamUrl, {
    headers: { Authorization: `GoogleLogin auth=${token}` },
  });
  if (!response.ok) {
    throw new Error(`FreshRSS stream fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RawStreamResponse;

  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.title ?? "Untitled",
    link: item.canonical?.[0]?.href ?? item.alternate?.[0]?.href ?? baseUrl,
    feedTitle: item.origin?.title ?? "Unknown feed",
    publishedAt: item.published ? new Date(item.published * 1000).toISOString() : null,
  }));
}
