import { contextBridge, ipcRenderer } from "electron";
import type { RepoSummary } from "@productivityhub/github";
import type { AppSettings, WorkspaceState } from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  getWorkspaces: (): Promise<WorkspaceState> => ipcRenderer.invoke("config:get-workspaces"),
  saveWorkspaces: (state: WorkspaceState): Promise<void> =>
    ipcRenderer.invoke("config:save-workspaces", state),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("config:get-settings"),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke("config:save-settings", settings),
});
