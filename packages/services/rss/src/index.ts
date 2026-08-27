import Parser from "rss-parser";

export interface RssFeedInput {
  id: string;
  url: string;
  title?: string;
}

export interface RssItem {
  id: string;
  title: string;
  link: string;
  feedTitle: string;
  publishedAt: string | null;
}

export interface RssFeedError {
  feedId: string;
  url: string;
  title: string;
  message: string;
}

export interface RssFetchResult {
  items: RssItem[];
  errors: RssFeedError[];
}

export interface RssFetchOptions {
  maxItems?: number;
  maxAgeDays?: number;
}

const parser = new Parser();

async function fetchFeed(feed: RssFeedInput): Promise<RssItem[] | { error: RssFeedError }> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const feedTitle = feed.title ?? parsed.title ?? feed.url;

    return (parsed.items ?? []).map((item, index) => ({
      id: item.guid ?? item.link ?? `${feed.id}-${index}`,
      title: item.title ?? "Untitled",
      link: item.link ?? feed.url,
      feedTitle,
      publishedAt: item.isoDate ?? item.pubDate ?? null,
    }));
  } catch (err) {
    return {
      error: {
        feedId: feed.id,
        url: feed.url,
        title: feed.title ?? feed.url,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// Fetches every feed independently (a broken/unreachable feed produces an
// error entry rather than failing the whole batch), then merges, age-filters,
// date-sorts (newest first), and caps the combined result to maxItems.
export async function getFeedItems(
  feeds: RssFeedInput[],
  options: RssFetchOptions = {},
): Promise<RssFetchResult> {
  const results = await Promise.all(feeds.map(fetchFeed));

  const items: RssItem[] = [];
  const errors: RssFeedError[] = [];
  for (const result of results) {
    if (Array.isArray(result)) {
      items.push(...result);
    } else {
      errors.push(result.error);
    }
  }

  const cutoff = options.maxAgeDays ? Date.now() - options.maxAgeDays * 86_400_000 : null;
  const filtered = cutoff
    ? items.filter((item) => {
        if (!item.publishedAt) return true;
        const time = new Date(item.publishedAt).getTime();
        return Number.isNaN(time) || time >= cutoff;
      })
    : items;

  filtered.sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  const limited = options.maxItems ? filtered.slice(0, options.maxItems) : filtered;

  return { items: limited, errors };
}
