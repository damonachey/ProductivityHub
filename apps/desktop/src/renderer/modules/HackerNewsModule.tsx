import type { HackerNewsStory } from "@productivityhub/hackernews";
import { useCachedData } from "../useCachedData";

const CACHE_KEY = "hackernews-stories";
const CACHE_TTL_MS = 15 * 60 * 1000; // rankings shift over minutes, not seconds

function formatAge(unixSeconds: number): string {
  if (!unixSeconds) return "unknown";
  const diffMs = Date.now() - unixSeconds * 1000;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HackerNewsModule() {
  const { data: stories, error } = useCachedData<HackerNewsStory[]>(
    CACHE_KEY,
    CACHE_TTL_MS,
    () => window.api.getHackerNewsStories(),
  );

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!stories) {
    return <p>Loading…</p>;
  }

  if (stories.length === 0) {
    return <p className="module-placeholder">No stories.</p>;
  }

  return (
    <ul className="repo-list">
      {stories.map((story) => (
        <li key={story.id} className="repo-item">
          <a className="repo-name" href={story.url} target="_blank" rel="noreferrer">
            {story.title}
          </a>
          <div className="repo-meta">
            <span>{story.points} pts</span>
            <span>{story.author}</span>
            <span>{story.commentCount} comments</span>
            <span>{formatAge(story.time)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
