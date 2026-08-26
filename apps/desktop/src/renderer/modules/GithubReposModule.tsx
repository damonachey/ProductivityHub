import type { RepoSummary } from "@productivityhub/github";
import { useCachedData } from "../useCachedData";

const CACHE_KEY = "github-repos";
const CACHE_TTL_MS = 5 * 60 * 1000; // repos change infrequently

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GithubReposModule() {
  const { data: repos, error } = useCachedData<RepoSummary[]>(CACHE_KEY, CACHE_TTL_MS, () =>
    window.api.listRepos(),
  );

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!repos) {
    return <p>Loading…</p>;
  }

  return (
    <ul className="repo-list">
      {repos.map((repo) => (
        <li key={repo.name} className="repo-item">
          <a className="repo-name" href={repo.htmlUrl} target="_blank" rel="noreferrer">
            {repo.name}
          </a>
          <div className="repo-meta">
            {repo.private && <span className="repo-badge">Private</span>}
            {repo.language && <span>{repo.language}</span>}
            <span>★ {repo.stars}</span>
            <span>Updated {formatDate(repo.updatedAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
