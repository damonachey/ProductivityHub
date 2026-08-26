import Parser from "rss-parser";

const FEED_URL = "https://rss.slashdot.org/Slashdot/slashdotMain";

export interface SlashdotHeadline {
  title: string;
  link: string;
  pubDate: string | null;
  creator: string | null;
}

export async function getHeadlines(): Promise<SlashdotHeadline[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(FEED_URL);

  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "Untitled",
    link: item.link ?? FEED_URL,
    pubDate: item.pubDate ?? item.isoDate ?? null,
    creator: item.creator ?? null,
  }));
}
