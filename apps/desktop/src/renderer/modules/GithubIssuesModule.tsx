import { useEffect, useState } from "react";
import type { IssueSummary } from "@productivityhub/github";
import { getCached, setCached } from "../cache";
import type { ModuleProps } from "./types";

function cacheKey(repoPath: string): string {
  return `github-issues-${repoPath}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GithubIssuesModule({
  moduleId,
  lockLayout,
  refreshIntervalsMinutes,
  onTitleUrlChange,
  onTitleTextChange,
}: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.githubIssues * 60_000;
  const [repoPath, setRepoPath] = useState("");
  const [draftRepoPath, setDraftRepoPath] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [issues, setIssues] = useState<IssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .getGithubIssuesRepo(moduleId)
      .then((saved) => {
        setRepoPath(saved);
        setDraftRepoPath(saved);
        setIssues(saved ? (getCached<IssueSummary[]>(cacheKey(saved)) ?? null) : null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoaded(true));
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) setDraftRepoPath(repoPath);
  }, [lockLayout, repoPath]);

  useEffect(() => {
    if (!repoPath) return;

    let cancelled = false;

    function fetchIssues(): void {
      window.api
        .listGithubIssues(repoPath)
        .then((result) => {
          if (cancelled) return;
          setIssues(result);
          setCached(cacheKey(repoPath), result, refreshIntervalMs);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }

    fetchIssues();
    const interval = setInterval(fetchIssues, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [repoPath, refreshIntervalMs]);

  useEffect(() => {
    // Deliberately not depending on onTitleUrlChange itself - it's a fresh
    // closure every WorkspaceView render, and re-firing only when the
    // actual link target changes avoids feedback-looping into re-renders.
    onTitleUrlChange?.(repoPath ? `https://github.com/${repoPath}/issues` : null);
    return () => onTitleUrlChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  useEffect(() => {
    onTitleTextChange?.(repoPath ? `GitHub Issues - ${repoPath}` : null);
    return () => onTitleTextChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  function commitRepoPath(): void {
    const normalized = draftRepoPath.trim().replace(/^\/+|\/+$/g, "");
    if (!normalized) return;
    setRepoPath(normalized);
    setIssues(getCached<IssueSummary[]>(cacheKey(normalized)) ?? null);
    setError(null);
    window.api.saveGithubIssuesRepo(moduleId, normalized);
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="github-issues-module">
      {!lockLayout && (
        <div className="weather-form">
          <input
            className="weather-location-input"
            value={draftRepoPath}
            placeholder="owner/repo, e.g. damonachey/ProductivityHub"
            onChange={(event) => setDraftRepoPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRepoPath();
            }}
          />
          <button onClick={commitRepoPath}>Set</button>
        </div>
      )}

      {error ? (
        <p className="module-error">Error: {error}</p>
      ) : !repoPath ? (
        <p className="module-placeholder">Enter a repo as "owner/repo" above.</p>
      ) : !issues ? (
        <p>Loading…</p>
      ) : issues.length === 0 ? (
        <p className="module-placeholder">No open issues.</p>
      ) : (
        <ul className="repo-list">
          {issues.map((issue) => (
            <li key={issue.number} className="repo-item">
              <a className="repo-name" href={issue.htmlUrl} target="_blank" rel="noreferrer">
                #{issue.number} {issue.title}
              </a>
              <div className="repo-meta">
                {issue.isPullRequest && <span className="repo-badge">PR</span>}
                {issue.author && <span>{issue.author}</span>}
                {issue.labels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
                <span>Updated {formatDate(issue.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
