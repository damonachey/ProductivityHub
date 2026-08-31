import { Octokit } from "@octokit/rest";
import { requireEnv } from "@productivityhub/core";

export interface RepoSummary {
  name: string;
  private: boolean;
  updatedAt: string | null;
  htmlUrl: string;
  language: string | null;
  stars: number;
}

function createClient(): Octokit {
  return new Octokit({ auth: requireEnv("GITHUB_TOKEN") });
}

export async function getMyGithubUrl(): Promise<string> {
  const octokit = createClient();
  const { data } = await octokit.rest.users.getAuthenticated();
  return data.html_url;
}

export async function listMyRepos(): Promise<RepoSummary[]> {
  const octokit = createClient();
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 20,
  });

  return data.map((repo) => ({
    name: repo.full_name,
    private: repo.private,
    updatedAt: repo.updated_at ?? null,
    htmlUrl: repo.html_url,
    language: repo.language ?? null,
    stars: repo.stargazers_count ?? 0,
  }));
}

export interface NotificationSummary {
  id: string;
  title: string;
  repository: string;
  reason: string;
  unread: boolean;
  updatedAt: string | null;
  url: string;
}

function subjectWebUrl(apiUrl: string | null, subjectType: string, fallback: string): string {
  if (!apiUrl) return fallback;
  const webUrl = apiUrl.replace("https://api.github.com/repos/", "https://github.com/");
  if (subjectType === "PullRequest") return webUrl.replace("/pulls/", "/pull/");
  if (subjectType === "Commit") return webUrl.replace("/commits/", "/commit/");
  return webUrl;
}

export async function listMyNotifications(): Promise<NotificationSummary[]> {
  const octokit = createClient();
  const { data } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
    per_page: 20,
  });

  return data.map((notification) => ({
    id: notification.id,
    title: notification.subject.title,
    repository: notification.repository.full_name,
    reason: notification.reason,
    unread: notification.unread,
    updatedAt: notification.updated_at ?? null,
    url: subjectWebUrl(
      notification.subject.url,
      notification.subject.type,
      notification.repository.html_url,
    ),
  }));
}

export interface IssueSummary {
  number: number;
  title: string;
  htmlUrl: string;
  state: "open" | "closed";
  isPullRequest: boolean;
  labels: string[];
  author: string | null;
  updatedAt: string | null;
}

// `repoPath` is "owner/repo". The issues endpoint also returns pull requests
// (they share the same underlying tracker item), so those are filtered out
// and flagged separately for callers who want to distinguish them.
export async function listIssuesForRepo(repoPath: string): Promise<IssueSummary[]> {
  const [owner, repo] = repoPath.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo path "${repoPath}" - expected "owner/repo".`);
  }

  const octokit = createClient();
  const { data } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    sort: "updated",
    direction: "desc",
    per_page: 30,
  });

  return data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    htmlUrl: issue.html_url,
    state: issue.state as "open" | "closed",
    isPullRequest: Boolean(issue.pull_request),
    labels: issue.labels.map((label) => (typeof label === "string" ? label : (label.name ?? ""))),
    author: issue.user?.login ?? null,
    updatedAt: issue.updated_at ?? null,
  }));
}
