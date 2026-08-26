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
