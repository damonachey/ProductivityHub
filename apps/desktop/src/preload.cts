import { contextBridge, ipcRenderer } from "electron";
import type { RepoSummary } from "@productivityhub/github";
import type { WorkspaceState } from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  getWorkspaces: (): Promise<WorkspaceState> => ipcRenderer.invoke("config:get-workspaces"),
  saveWorkspaces: (state: WorkspaceState): Promise<void> =>
    ipcRenderer.invoke("config:save-workspaces", state),
});
