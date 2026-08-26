import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import windowStateKeeper from "electron-window-state";
import { CONFIG_DIR } from "@productivityhub/core";
import { listMyRepos, listMyNotifications } from "@productivityhub/github";
import type { AppSettings, WorkspaceState } from "./types.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WORKSPACES_FILE = path.join(CONFIG_DIR, "workspaces.json");
const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");

const DEFAULT_SETTINGS: AppSettings = { rememberActiveTab: true, lockLayout: false };

function getWorkspaceState(): WorkspaceState {
  try {
    const raw = JSON.parse(fs.readFileSync(WORKSPACES_FILE, "utf-8"));
    // Back-compat: older files stored a plain Workspace[] with no activeId.
    if (Array.isArray(raw)) {
      return { activeId: raw[0]?.id ?? "", workspaces: raw };
    }
    return raw as WorkspaceState;
  } catch {
    return { activeId: "", workspaces: [] };
  }
}

function saveWorkspaceState(state: WorkspaceState): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(state, null, 2));
}

function getSettings(): AppSettings {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<AppSettings>),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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

  // Any target="_blank" link (or window.open()) opens in the OS default
  // browser instead of a new Electron window.
  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  window.loadFile(path.join(dirname, "renderer", "index.html"));
}

ipcMain.handle("github:list-repos", () => listMyRepos());
ipcMain.handle("github:list-notifications", () => listMyNotifications());
ipcMain.handle("config:get-workspaces", () => getWorkspaceState());
ipcMain.handle("config:save-workspaces", (_event, state: WorkspaceState) =>
  saveWorkspaceState(state),
);
ipcMain.handle("config:get-settings", () => getSettings());
ipcMain.handle("config:save-settings", (_event, settings: AppSettings) => saveSettings(settings));

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
