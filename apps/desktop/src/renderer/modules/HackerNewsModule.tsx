import type { HackerNewsStory } from "@productivityhub/hackernews";
import { HACKERNEWS_CACHE_KEY } from "../search";
import { useCachedData } from "../useCachedData";
import type { ModuleProps } from "./types";

function formatAge(unixSeconds: number): string {
  if (!unixSeconds) return "unknown";
  const diffMs = Date.now() - unixSeconds * 1000;
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HackerNewsModule({ refreshIntervalsMinutes }: ModuleProps) {
  const { data: stories, error } = useCachedData<HackerNewsStory[]>(
    HACKERNEWS_CACHE_KEY,
    refreshIntervalsMinutes.hackernews * 60_000,
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
        <li key={story.id} data-search-item-id={story.id} className="repo-item">
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
