import type { RepoSummary } from "@productivityhub/github";
import type { Workspace } from "../types";

declare global {
  interface Window {
    api: {
      listRepos: () => Promise<RepoSummary[]>;
      getWorkspaces: () => Promise<Workspace[]>;
      saveWorkspaces: (workspaces: Workspace[]) => Promise<void>;
    };
  }
}

export {};
