import { contextBridge, ipcRenderer } from "electron";
import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { SlashdotHeadline } from "@productivityhub/slashdot";
import type { HackerNewsStory } from "@productivityhub/hackernews";
import type { FreshRssItem } from "@productivityhub/freshrss";
import type { StockQuote } from "@productivityhub/yahoo-finance";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  NotesState,
  Rect,
  StockItem,
  StocksState,
  WorkspaceState,
} from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  listNotifications: (): Promise<NotificationSummary[]> =>
    ipcRenderer.invoke("github:list-notifications"),
  getGithubProfileUrl: (): Promise<string> => ipcRenderer.invoke("github:get-profile-url"),
  getSlashdotHeadlines: (): Promise<SlashdotHeadline[]> =>
    ipcRenderer.invoke("slashdot:get-headlines"),
  getHackerNewsStories: (): Promise<HackerNewsStory[]> =>
    ipcRenderer.invoke("hackernews:get-stories"),
  getFreshRssUnread: (): Promise<FreshRssItem[]> => ipcRenderer.invoke("freshrss:get-unread"),
  getWorkspaces: (): Promise<WorkspaceState> => ipcRenderer.invoke("config:get-workspaces"),
  saveWorkspaces: (state: WorkspaceState): Promise<void> =>
    ipcRenderer.invoke("config:save-workspaces", state),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("config:get-settings"),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke("config:save-settings", settings),
  getNotes: (): Promise<NotesState> => ipcRenderer.invoke("notes:get"),
  saveNote: (moduleId: string, text: string): Promise<void> =>
    ipcRenderer.invoke("notes:save", moduleId, text),
  getBookmarks: (): Promise<BookmarksState> => ipcRenderer.invoke("bookmarks:get"),
  saveBookmarks: (moduleId: string, items: BookmarkItem[]): Promise<void> =>
    ipcRenderer.invoke("bookmarks:save", moduleId, items),
  getStocks: (): Promise<StocksState> => ipcRenderer.invoke("stocks:get"),
  saveStocks: (moduleId: string, items: StockItem[]): Promise<void> =>
    ipcRenderer.invoke("stocks:save", moduleId, items),
  getStockQuotes: (symbols: string[]): Promise<StockQuote[]> =>
    ipcRenderer.invoke("stocks:get-quotes", symbols),
  getWebPageUrl: (moduleId: string): Promise<string> => ipcRenderer.invoke("webpage:get-url", moduleId),
  syncWebPage: (moduleId: string, bounds: Rect): Promise<void> =>
    ipcRenderer.invoke("webpage:sync", moduleId, bounds),
  hideWebPage: (moduleId: string): Promise<void> => ipcRenderer.invoke("webpage:hide", moduleId),
  navigateWebPage: (moduleId: string, pageUrl: string): Promise<void> =>
    ipcRenderer.invoke("webpage:navigate", moduleId, pageUrl),
  webPageGoBack: (moduleId: string): Promise<void> => ipcRenderer.invoke("webpage:go-back", moduleId),
  webPageGoForward: (moduleId: string): Promise<void> =>
    ipcRenderer.invoke("webpage:go-forward", moduleId),
  webPageReload: (moduleId: string): Promise<void> => ipcRenderer.invoke("webpage:reload", moduleId),
  onWebPageNavigated: (callback: (moduleId: string, pageUrl: string) => void): (() => void) => {
    const listener = (_event: unknown, moduleId: string, pageUrl: string) =>
      callback(moduleId, pageUrl);
    ipcRenderer.on("webpage:navigated", listener);
    return () => ipcRenderer.removeListener("webpage:navigated", listener);
  },
});
