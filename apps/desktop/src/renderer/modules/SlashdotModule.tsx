import type { SlashdotHeadline } from "@productivityhub/slashdot";
import { useCachedData } from "../useCachedData";
import type { ModuleProps } from "./types";

const CACHE_KEY = "slashdot-headlines";

function formatDate(pubDate: string | null): string {
  if (!pubDate) return "unknown";
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SlashdotModule({ refreshIntervalsMinutes }: ModuleProps) {
  const { data: headlines, error } = useCachedData<SlashdotHeadline[]>(
    CACHE_KEY,
    refreshIntervalsMinutes.slashdot * 60_000,
    () => window.api.getSlashdotHeadlines(),
  );

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!headlines) {
    return <p>Loading…</p>;
  }

  if (headlines.length === 0) {
    return <p className="module-placeholder">No headlines.</p>;
  }

  return (
    <ul className="repo-list">
      {headlines.map((headline) => (
        <li key={headline.link} className="repo-item">
          <a className="repo-name" href={headline.link} target="_blank" rel="noreferrer">
            {headline.title}
          </a>
          <div className="repo-meta">
            {headline.creator && <span>{headline.creator}</span>}
            <span>{formatDate(headline.pubDate)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
