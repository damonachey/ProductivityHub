import type { RepoSummary } from "@productivityhub/github";

declare global {
  interface Window {
    api: {
      listRepos: () => Promise<RepoSummary[]>;
    };
  }
}

export {};
