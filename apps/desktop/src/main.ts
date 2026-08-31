import { app, BrowserWindow, dialog, ipcMain, shell, WebContentsView } from "electron";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { listMyRepos, listMyNotifications, getMyGithubUrl } from "@productivityhub/github";
import { getHeadlines } from "@productivityhub/slashdot";
import { getTopStories } from "@productivityhub/hackernews";
import { getUnreadItems } from "@productivityhub/freshrss";
import { getFeedItems } from "@productivityhub/rss";
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
import {
  authenticate as authenticateGoogleTasks,
  createTask as createGoogleTask,
  deleteTask as deleteGoogleTask,
  disconnect as disconnectGoogleTasks,
  isAuthenticated as isGoogleTasksAuthenticated,
  listTasks as listGoogleTasks,
  setTaskStatus as setGoogleTaskStatus,
  type CreateTaskInput,
} from "@productivityhub/google-tasks";
import {
  authenticate as authenticateGoogleCalendar,
  disconnect as disconnectGoogleCalendar,
  isAuthenticated as isGoogleCalendarAuthenticated,
  listUpcomingEvents,
  listEventsInRange as listGoogleCalendarEventsInRange,
} from "@productivityhub/google-calendar";
import { getForecast as getWeatherForecast } from "@productivityhub/open-meteo";
import windowStateKeeper from "electron-window-state";
import {
  getWorkspaceState,
  saveWorkspaceState,
  getSettings,
  saveSettings,
  getNotes,
  saveNote,
  getBookmarks,
  saveBookmarks,
  getStocks,
  saveStocks,
  getStockCharts,
  saveStockChartSymbol,
  getGoogleTasksFilters,
  saveGoogleTasksFilters,
  getWeatherLocations,
  saveWeatherLocation,
  getRssSettings,
  saveRssSettings,
  getWebPages,
  saveWebPages,
  saveWebPageUrl,
  readState,
  writeState,
  validateAndNormalizeImportedState,
} from "./settings.js";
import type {
  AppSettings,
  BookmarkItem,
  Rect,
  RssModuleSettings,
  StockItem,
  WorkspaceState,
} from "./types.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
const webPageViews = new Map<string, WebContentsView>();

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

  // Modules like Google Tasks delay committing an action (e.g. completing a
  // task) behind a short "pie timer" undo window. If the app quits while one
  // is still pending, skip the wait and let the renderer flush it now rather
  // than losing the action. `closeConfirmed` avoids re-entering this on the
  // second, renderer-triggered close; the timeout is a safety net in case
  // the renderer never acks (e.g. it crashed).
  let closeConfirmed = false;
  window.on("close", (event) => {
    if (closeConfirmed) return;
    event.preventDefault();
    window.webContents.send("app:flush-before-quit");
    setTimeout(() => {
      if (closeConfirmed) return;
      closeConfirmed = true;
      window.close();
    }, 4000);
  });
  ipcMain.on("app:flush-complete", () => {
    closeConfirmed = true;
    window.close();
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
ipcMain.handle("config:export", async (): Promise<{ ok: boolean; filePath?: string; error?: string }> => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export settings",
    defaultPath: "productivityhub-config.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.writeFileSync(result.filePath, JSON.stringify(readState(), null, 2));
  return { ok: true, filePath: result.filePath };
});
ipcMain.handle("config:import", async (): Promise<{ ok: boolean; error?: string }> => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import settings",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  const validated = validateAndNormalizeImportedState(parsed);
  if (!validated.ok) return { ok: false, error: validated.error };

  writeState(validated.state);
  reconcileWebPageViews(validated.state.workspaces);
  mainWindow.webContents.reload();
  return { ok: true };
});
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
ipcMain.handle("stock-chart:get-all", () => getStockCharts());
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
ipcMain.handle("google-tasks:is-authenticated", () => isGoogleTasksAuthenticated());
ipcMain.handle("google-tasks:authenticate", () =>
  authenticateGoogleTasks((authUrl) => shell.openExternal(authUrl)),
);
ipcMain.handle("google-tasks:disconnect", () => disconnectGoogleTasks());
ipcMain.handle("google-tasks:list", () => listGoogleTasks());
ipcMain.handle("google-tasks:create", (_event, input: CreateTaskInput) => createGoogleTask(input));
ipcMain.handle(
  "google-tasks:set-status",
  (_event, taskId: string, status: "needsAction" | "completed") =>
    setGoogleTaskStatus(taskId, status),
);
ipcMain.handle("google-tasks:delete", (_event, taskId: string) => deleteGoogleTask(taskId));
ipcMain.handle("google-tasks:get-filters", (_event, moduleId: string) =>
  getGoogleTasksFilters()[moduleId] ?? null,
);
ipcMain.handle("google-tasks:save-filters", (_event, moduleId: string, filters: string[]) =>
  saveGoogleTasksFilters(moduleId, filters),
);
ipcMain.handle("google-calendar:is-authenticated", () => isGoogleCalendarAuthenticated());
ipcMain.handle("google-calendar:authenticate", () =>
  authenticateGoogleCalendar((authUrl) => shell.openExternal(authUrl)),
);
ipcMain.handle("google-calendar:disconnect", () => disconnectGoogleCalendar());
// Scoped to "list-events" (rather than a generic "get events") so a future
// grid/month view can add its own date-ranged query alongside this one
// without colliding - both would share the same auth channels above.
ipcMain.handle("google-calendar:list-events", () => listUpcomingEvents());
ipcMain.handle("google-calendar:list-events-range", (_event, timeMin: string, timeMax: string) =>
  listGoogleCalendarEventsInRange(timeMin, timeMax),
);
ipcMain.handle("weather:get-location", (_event, moduleId: string) =>
  getWeatherLocations()[moduleId] ?? "",
);
ipcMain.handle("weather:get-all-locations", () => getWeatherLocations());
ipcMain.handle("weather:save-location", (_event, moduleId: string, location: string) =>
  saveWeatherLocation(moduleId, location),
);
ipcMain.handle("weather:get-forecast", (_event, location: string) => getWeatherForecast(location));
ipcMain.handle("rss:get-settings", (_event, moduleId: string) => getRssSettings(moduleId));
ipcMain.handle("rss:save-settings", (_event, moduleId: string, settings: RssModuleSettings) =>
  saveRssSettings(moduleId, settings),
);
ipcMain.handle("rss:get-items", (_event, moduleId: string) => {
  const settings = getRssSettings(moduleId);
  return getFeedItems(
    settings.feeds.map((feed) => ({ id: feed.id, url: feed.url, title: feed.title })),
    { maxItems: settings.maxItems, maxAgeDays: settings.maxAgeDays },
  );
});
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
