import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import windowStateKeeper from "electron-window-state";
import { CONFIG_DIR } from "@productivityhub/core";
import { listMyRepos } from "@productivityhub/github";
import type { Workspace } from "./types.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WORKSPACES_FILE = path.join(CONFIG_DIR, "workspaces.json");

function getWorkspaces(): Workspace[] {
  try {
    return JSON.parse(fs.readFileSync(WORKSPACES_FILE, "utf-8")) as Workspace[];
  } catch {
    return [];
  }
}

function saveWorkspaces(workspaces: Workspace[]): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
}

function createWindow(): void {
  const windowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800,
  });

  const window = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    webPreferences: {
      preload: path.join(dirname, "preload.cjs"),
    },
  });

  windowState.manage(window);

  window.loadFile(path.join(dirname, "renderer", "index.html"));
}

ipcMain.handle("github:list-repos", () => listMyRepos());
ipcMain.handle("config:get-workspaces", () => getWorkspaces());
ipcMain.handle("config:save-workspaces", (_event, workspaces: Workspace[]) =>
  saveWorkspaces(workspaces),
);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
