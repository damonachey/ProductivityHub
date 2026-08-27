import { app, BrowserWindow, ipcMain, shell, WebContentsView } from "electron";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import windowStateKeeper from "electron-window-state";
import { CONFIG_DIR } from "@productivityhub/core";
import { listMyRepos, listMyNotifications, getMyGithubUrl } from "@productivityhub/github";
import { getHeadlines } from "@productivityhub/slashdot";
import { getTopStories } from "@productivityhub/hackernews";
import { getUnreadItems } from "@productivityhub/freshrss";
import { getDailyCandles, getQuotes } from "@productivityhub/yahoo-finance";
import {
  archiveThread,
  authenticate as authenticateGmail,
  disconnect as disconnectGmail,
  isAuthenticated as isGmailAuthenticated,
  listInboxThreads,
  markThreadRead,
  markThreadUnread,
  trashThread,
} from "@productivityhub/google-mail";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  NotesState,
  Rect,
  StockChartsState,
  StockItem,
  StocksState,
  WebPagesState,
  WorkspaceState,
} from "./types.js";
import { DEFAULT_REFRESH_INTERVALS_MINUTES } from "./types.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const WORKSPACES_FILE = path.join(CONFIG_DIR, "workspaces.json");
const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");
const NOTES_FILE = path.join(CONFIG_DIR, "notes.json");
const BOOKMARKS_FILE = path.join(CONFIG_DIR, "bookmarks.json");
const WEBPAGES_FILE = path.join(CONFIG_DIR, "webpages.json");
const STOCKS_FILE = path.join(CONFIG_DIR, "stocks.json");
const STOCK_CHARTS_FILE = path.join(CONFIG_DIR, "stock-charts.json");

let mainWindow: BrowserWindow | null = null;
const webPageViews = new Map<string, WebContentsView>();

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const DEFAULT_SETTINGS: AppSettings = {
  rememberActiveTab: true,
  lockLayout: false,
  refreshIntervalsMinutes: DEFAULT_REFRESH_INTERVALS_MINUTES,
};

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
    const stored = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      refreshIntervalsMinutes: {
        ...DEFAULT_REFRESH_INTERVALS_MINUTES,
        ...stored.refreshIntervalsMinutes,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function getNotes(): NotesState {
  try {
    return JSON.parse(fs.readFileSync(NOTES_FILE, "utf-8")) as NotesState;
  } catch {
    return {};
  }
}

function saveNote(moduleId: string, text: string): void {
  const notes = getNotes();
  notes[moduleId] = text;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

function getBookmarks(): BookmarksState {
  try {
    return JSON.parse(fs.readFileSync(BOOKMARKS_FILE, "utf-8")) as BookmarksState;
  } catch {
    return {};
  }
}

function saveBookmarks(moduleId: string, items: BookmarkItem[]): void {
  const bookmarks = getBookmarks();
  bookmarks[moduleId] = items;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2));
}

function getStocks(): StocksState {
  try {
    return JSON.parse(fs.readFileSync(STOCKS_FILE, "utf-8")) as StocksState;
  } catch {
    return {};
  }
}

function saveStocks(moduleId: string, items: StockItem[]): void {
  const stocks = getStocks();
  stocks[moduleId] = items;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(STOCKS_FILE, JSON.stringify(stocks, null, 2));
}

function getStockCharts(): StockChartsState {
  try {
    return JSON.parse(fs.readFileSync(STOCK_CHARTS_FILE, "utf-8")) as StockChartsState;
  } catch {
    return {};
  }
}

function saveStockChartSymbol(moduleId: string, symbol: string): void {
  const charts = getStockCharts();
  charts[moduleId] = symbol;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(STOCK_CHARTS_FILE, JSON.stringify(charts, null, 2));
}

function getWebPages(): WebPagesState {
  try {
    return JSON.parse(fs.readFileSync(WEBPAGES_FILE, "utf-8")) as WebPagesState;
  } catch {
    return {};
  }
}

function saveWebPages(pages: WebPagesState): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(WEBPAGES_FILE, JSON.stringify(pages, null, 2));
}

function saveWebPageUrl(moduleId: string, pageUrl: string): void {
  const pages = getWebPages();
  pages[moduleId] = pageUrl;
  saveWebPages(pages);
}

// The view is created once per module instance and kept alive across
// workspace-tab switches (which unmount/remount the React module) so the
// page, its scroll position, and its login session don't reset every time
// you switch tabs away and back. It starts hidden (zero-size); the renderer
// grows it into place once it knows the placeholder <div>'s bounds.
function ensureWebPageView(moduleId: string): WebContentsView {
  let view = webPageViews.get(moduleId);
  if (view) return view;

  view = new WebContentsView({
    webPreferences: {
      partition: `persist:webpage-${moduleId}`,
    },
  });
  webPageViews.set(moduleId, view);
  mainWindow?.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  view.webContents.on("did-navigate", (_event, pageUrl) => {
    saveWebPageUrl(moduleId, pageUrl);
    mainWindow?.webContents.send("webpage:navigated", moduleId, pageUrl);
  });
  view.webContents.on("did-navigate-in-page", (_event, pageUrl) => {
    saveWebPageUrl(moduleId, pageUrl);
    mainWindow?.webContents.send("webpage:navigated", moduleId, pageUrl);
  });

  const initialUrl = getWebPages()[moduleId];
  if (initialUrl) {
    view.webContents.loadURL(initialUrl);
  }

  return view;
}

function destroyWebPageView(moduleId: string): void {
  const view = webPageViews.get(moduleId);
  if (!view) return;
  mainWindow?.contentView.removeChildView(view);
  view.webContents.close();
  webPageViews.delete(moduleId);
}

// Workspace/module removal doesn't get a dedicated "delete this webpage"
// signal - it just stops appearing in the saved workspace state (whether
// the module itself, or its whole workspace, was removed). So instead of
// hooking module removal directly, every workspace save reconciles live
// views against whatever webpage module ids still exist anywhere, and
// tears down anything orphaned.
function reconcileWebPageViews(state: WorkspaceState): void {
  const liveIds = new Set<string>();
  for (const workspace of state.workspaces) {
    for (const moduleInstance of workspace.modules) {
      if (moduleInstance.type === "webpage") liveIds.add(moduleInstance.id);
    }
  }

  for (const moduleId of webPageViews.keys()) {
    if (!liveIds.has(moduleId)) destroyWebPageView(moduleId);
  }

  const pages = getWebPages();
  let changed = false;
  for (const moduleId of Object.keys(pages)) {
    if (!liveIds.has(moduleId)) {
      delete pages[moduleId];
      changed = true;
    }
  }
  if (changed) saveWebPages(pages);
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
  mainWindow = window;

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
ipcMain.handle("github:get-profile-url", () => getMyGithubUrl());
ipcMain.handle("slashdot:get-headlines", () => getHeadlines());
ipcMain.handle("hackernews:get-stories", () => getTopStories());
ipcMain.handle("freshrss:get-unread", () => getUnreadItems());
ipcMain.handle("config:get-workspaces", () => getWorkspaceState());
ipcMain.handle("config:save-workspaces", (_event, state: WorkspaceState) => {
  saveWorkspaceState(state);
  reconcileWebPageViews(state);
});
ipcMain.handle("config:get-settings", () => getSettings());
ipcMain.handle("config:save-settings", (_event, settings: AppSettings) => saveSettings(settings));
ipcMain.handle("notes:get", () => getNotes());
ipcMain.handle("notes:save", (_event, moduleId: string, text: string) => saveNote(moduleId, text));
ipcMain.handle("bookmarks:get", () => getBookmarks());
ipcMain.handle("bookmarks:save", (_event, moduleId: string, items: BookmarkItem[]) =>
  saveBookmarks(moduleId, items),
);
ipcMain.handle("stocks:get", () => getStocks());
ipcMain.handle("stocks:save", (_event, moduleId: string, items: StockItem[]) =>
  saveStocks(moduleId, items),
);
ipcMain.handle("stocks:get-quotes", (_event, symbols: string[]) => getQuotes(symbols));
ipcMain.handle("stock-chart:get-symbol", (_event, moduleId: string) => getStockCharts()[moduleId] ?? "");
ipcMain.handle("stock-chart:save-symbol", (_event, moduleId: string, symbol: string) =>
  saveStockChartSymbol(moduleId, symbol),
);
ipcMain.handle("stock-chart:get-candles", (_event, symbol: string) => getDailyCandles(symbol));
ipcMain.handle("gmail:is-authenticated", () => isGmailAuthenticated());
ipcMain.handle("gmail:authenticate", () => authenticateGmail((authUrl) => shell.openExternal(authUrl)));
ipcMain.handle("gmail:disconnect", () => disconnectGmail());
ipcMain.handle("gmail:list-threads", () => listInboxThreads());
ipcMain.handle("gmail:mark-read", (_event, threadId: string) => markThreadRead(threadId));
ipcMain.handle("gmail:mark-unread", (_event, threadId: string) => markThreadUnread(threadId));
ipcMain.handle("gmail:archive", (_event, threadId: string) => archiveThread(threadId));
ipcMain.handle("gmail:trash", (_event, threadId: string) => trashThread(threadId));
ipcMain.handle("webpage:get-url", (_event, moduleId: string) => getWebPages()[moduleId] ?? "");
ipcMain.handle("webpage:sync", (_event, moduleId: string, bounds: Rect) => {
  const view = ensureWebPageView(moduleId);
  view.setBounds(bounds);
});
ipcMain.handle("webpage:hide", (_event, moduleId: string) => {
  webPageViews.get(moduleId)?.setBounds({ x: 0, y: 0, width: 0, height: 0 });
});
ipcMain.handle("webpage:navigate", (_event, moduleId: string, pageUrl: string) => {
  const view = webPageViews.get(moduleId);
  const normalized = normalizeUrl(pageUrl);
  if (view && normalized) view.webContents.loadURL(normalized);
});
ipcMain.handle("webpage:go-back", (_event, moduleId: string) => {
  const view = webPageViews.get(moduleId);
  if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
});
ipcMain.handle("webpage:go-forward", (_event, moduleId: string) => {
  const view = webPageViews.get(moduleId);
  if (view?.webContents.navigationHistory.canGoForward()) {
    view.webContents.navigationHistory.goForward();
  }
});
ipcMain.handle("webpage:reload", (_event, moduleId: string) => {
  webPageViews.get(moduleId)?.webContents.reload();
});

app.whenReady().then(() => {
  createWindow();
  reconcileWebPageViews(getWorkspaceState());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
