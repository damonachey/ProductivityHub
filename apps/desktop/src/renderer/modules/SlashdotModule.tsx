import type { SlashdotHeadline } from "@productivityhub/slashdot";
import { useCachedData } from "../useCachedData";

const CACHE_KEY = "slashdot-headlines";
const CACHE_TTL_MS = 15 * 60 * 1000; // headlines update every hour or so

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

export function SlashdotModule() {
  const { data: headlines, error } = useCachedData<SlashdotHeadline[]>(
    CACHE_KEY,
    CACHE_TTL_MS,
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
