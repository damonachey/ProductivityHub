import { contextBridge, ipcRenderer } from "electron";
import type { RepoSummary } from "@productivityhub/github";
import type { Workspace } from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  getWorkspaces: (): Promise<Workspace[]> => ipcRenderer.invoke("config:get-workspaces"),
  saveWorkspaces: (workspaces: Workspace[]): Promise<void> =>
    ipcRenderer.invoke("config:save-workspaces", workspaces),
});
