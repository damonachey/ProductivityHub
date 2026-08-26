import type { FreshRssItem } from "@productivityhub/freshrss";
import { useCachedData } from "../useCachedData";

const CACHE_KEY = "freshrss-unread";
const CACHE_TTL_MS = 5 * 60 * 1000; // unread counts should stay reasonably fresh

function formatDate(publishedAt: string | null): string {
  if (!publishedAt) return "unknown";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FreshRssModule() {
  const { data: items, error } = useCachedData<FreshRssItem[]>(CACHE_KEY, CACHE_TTL_MS, () =>
    window.api.getFreshRssUnread(),
  );

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!items) {
    return <p>Loading…</p>;
  }

  if (items.length === 0) {
    return <p className="module-placeholder">No unread items.</p>;
  }

  return (
    <ul className="repo-list">
      {items.map((item) => (
        <li key={item.id} className="repo-item">
          <a className="repo-name" href={item.link} target="_blank" rel="noreferrer">
            {item.title}
          </a>
          <div className="repo-meta">
            <span>{item.feedTitle}</span>
            <span>{formatDate(item.publishedAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
