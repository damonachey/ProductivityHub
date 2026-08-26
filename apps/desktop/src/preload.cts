import { contextBridge, ipcRenderer } from "electron";
import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { AppSettings, NotesState, WorkspaceState } from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  listNotifications: (): Promise<NotificationSummary[]> =>
    ipcRenderer.invoke("github:list-notifications"),
  getGithubProfileUrl: (): Promise<string> => ipcRenderer.invoke("github:get-profile-url"),
  getWorkspaces: (): Promise<WorkspaceState> => ipcRenderer.invoke("config:get-workspaces"),
  saveWorkspaces: (state: WorkspaceState): Promise<void> =>
    ipcRenderer.invoke("config:save-workspaces", state),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("config:get-settings"),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke("config:save-settings", settings),
  getNotes: (): Promise<NotesState> => ipcRenderer.invoke("notes:get"),
  saveNote: (moduleId: string, text: string): Promise<void> =>
    ipcRenderer.invoke("notes:save", moduleId, text),
});
