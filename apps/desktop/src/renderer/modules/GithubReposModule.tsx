import { useEffect, useState } from "react";
import type { RepoSummary } from "@productivityhub/github";

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
        <li key={repo.name}>
          <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
            {repo.name} ({repo.private ? "private" : "public"}) — updated {repo.updatedAt}
          </a>
        </li>
      ))}
    </ul>
  );
}
