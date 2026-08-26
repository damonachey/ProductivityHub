import type { RepoSummary } from "@productivityhub/github";
import type { WorkspaceState } from "../types";

declare global {
  interface Window {
    api: {
      listRepos: () => Promise<RepoSummary[]>;
      getWorkspaces: () => Promise<WorkspaceState>;
      saveWorkspaces: (state: WorkspaceState) => Promise<void>;
    };
  }
}

export {};
