import type { FreshRssItem } from "@productivityhub/freshrss";
import { FRESHRSS_CACHE_KEY } from "../search";
import { useCachedData } from "../useCachedData";
import type { ModuleProps } from "./types";

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

export function FreshRssModule({ refreshIntervalsMinutes }: ModuleProps) {
  const { data: items, error } = useCachedData<FreshRssItem[]>(
    FRESHRSS_CACHE_KEY,
    refreshIntervalsMinutes.freshrss * 60_000,
    () => window.api.getFreshRssUnread(),
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
        <li key={item.id} data-search-item-id={item.id} className="repo-item">
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
