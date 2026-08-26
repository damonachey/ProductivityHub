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
