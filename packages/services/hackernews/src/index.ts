const API_BASE = "https://hacker-news.firebaseio.com/v0";
const STORY_COUNT = 30;

export interface HackerNewsStory {
  id: number;
  title: string;
  url: string;
  points: number;
  author: string;
  commentCount: number;
  time: number;
}

interface RawItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  descendants?: number;
  time?: number;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  return (await response.json()) as T;
}

export async function getTopStories(): Promise<HackerNewsStory[]> {
  const ids = await fetchJson<number[]>("/topstories.json");
  const items = await Promise.all(
    ids.slice(0, STORY_COUNT).map((id) => fetchJson<RawItem>(`/item/${id}.json`)),
  );

  return items
    .filter((item): item is RawItem => item != null && item.title != null)
    .map((item) => ({
      id: item.id,
      title: item.title ?? "Untitled",
      url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
      points: item.score ?? 0,
      author: item.by ?? "unknown",
      commentCount: item.descendants ?? 0,
      time: item.time ?? 0,
    }));
}
