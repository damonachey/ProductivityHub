import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { AppSettings, NotesState, WorkspaceState } from "../types";

declare global {
  interface Window {
    api: {
      listRepos: () => Promise<RepoSummary[]>;
      listNotifications: () => Promise<NotificationSummary[]>;
      getGithubProfileUrl: () => Promise<string>;
      getWorkspaces: () => Promise<WorkspaceState>;
      saveWorkspaces: (state: WorkspaceState) => Promise<void>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<void>;
      getNotes: () => Promise<NotesState>;
      saveNote: (moduleId: string, text: string) => Promise<void>;
    };
  }
}

export {};
