import { useEffect, useState } from "react";
import type { RepoSummary } from "@productivityhub/github";

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GithubReposModule() {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .listRepos()
      .then(setRepos)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

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
