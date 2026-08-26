import { contextBridge, ipcRenderer } from "electron";
import type { RepoSummary } from "@productivityhub/github";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
});
