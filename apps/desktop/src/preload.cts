import { contextBridge, ipcRenderer } from "electron";
import type { IssueSummary, NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { SlashdotHeadline } from "@productivityhub/slashdot";
import type { HackerNewsStory } from "@productivityhub/hackernews";
import type { FreshRssItem } from "@productivityhub/freshrss";
import type { Candle, StockQuote } from "@productivityhub/yahoo-finance";
import type { GmailThreadSummary } from "@productivityhub/google-mail";
import type { CreateTaskInput, GoogleTask } from "@productivityhub/google-tasks";
import type { CalendarEvent } from "@productivityhub/google-calendar";
import type { WeatherForecast } from "@productivityhub/open-meteo";
import type { RssFetchResult } from "@productivityhub/rss";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  GithubIssuesState,
  NotesState,
  Rect,
  RssModuleSettings,
  StockChartsState,
  StockItem,
  StocksState,
  WeatherLocationsState,
  WorkspaceState,
} from "./types.js";

contextBridge.exposeInMainWorld("api", {
  listRepos: (): Promise<RepoSummary[]> => ipcRenderer.invoke("github:list-repos"),
  listNotifications: (): Promise<NotificationSummary[]> =>
    ipcRenderer.invoke("github:list-notifications"),
  getGithubProfileUrl: (): Promise<string> => ipcRenderer.invoke("github:get-profile-url"),
  listGithubIssues: (repoPath: string): Promise<IssueSummary[]> =>
    ipcRenderer.invoke("github:list-issues", repoPath),
  getGithubIssuesRepo: (moduleId: string): Promise<string> =>
    ipcRenderer.invoke("github-issues:get-repo", moduleId),
  getAllGithubIssuesRepos: (): Promise<GithubIssuesState> =>
    ipcRenderer.invoke("github-issues:get-all"),
  saveGithubIssuesRepo: (moduleId: string, repoPath: string): Promise<void> =>
    ipcRenderer.invoke("github-issues:save-repo", moduleId, repoPath),
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
  exportConfig: (): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke("config:export"),
  importConfig: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("config:import"),
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
  getStockChartSymbol: (moduleId: string): Promise<string> =>
    ipcRenderer.invoke("stock-chart:get-symbol", moduleId),
  getAllStockChartSymbols: (): Promise<StockChartsState> => ipcRenderer.invoke("stock-chart:get-all"),
  saveStockChartSymbol: (moduleId: string, symbol: string): Promise<void> =>
    ipcRenderer.invoke("stock-chart:save-symbol", moduleId, symbol),
  getStockCandles: (symbol: string): Promise<Candle[]> =>
    ipcRenderer.invoke("stock-chart:get-candles", symbol),
  isGmailAuthenticated: (): Promise<boolean> => ipcRenderer.invoke("gmail:is-authenticated"),
  authenticateGmail: (): Promise<void> => ipcRenderer.invoke("gmail:authenticate"),
  disconnectGmail: (): Promise<void> => ipcRenderer.invoke("gmail:disconnect"),
  listGmailThreads: (): Promise<GmailThreadSummary[]> => ipcRenderer.invoke("gmail:list-threads"),
  markGmailThreadRead: (threadId: string): Promise<void> =>
    ipcRenderer.invoke("gmail:mark-read", threadId),
  markGmailThreadUnread: (threadId: string): Promise<void> =>
    ipcRenderer.invoke("gmail:mark-unread", threadId),
  archiveGmailThread: (threadId: string): Promise<void> =>
    ipcRenderer.invoke("gmail:archive", threadId),
  trashGmailThread: (threadId: string): Promise<void> => ipcRenderer.invoke("gmail:trash", threadId),
  isGoogleTasksAuthenticated: (): Promise<boolean> =>
    ipcRenderer.invoke("google-tasks:is-authenticated"),
  authenticateGoogleTasks: (): Promise<void> => ipcRenderer.invoke("google-tasks:authenticate"),
  disconnectGoogleTasks: (): Promise<void> => ipcRenderer.invoke("google-tasks:disconnect"),
  listGoogleTasks: (): Promise<GoogleTask[]> => ipcRenderer.invoke("google-tasks:list"),
  createGoogleTask: (input: CreateTaskInput): Promise<GoogleTask> =>
    ipcRenderer.invoke("google-tasks:create", input),
  setGoogleTaskStatus: (taskId: string, status: "needsAction" | "completed"): Promise<void> =>
    ipcRenderer.invoke("google-tasks:set-status", taskId, status),
  deleteGoogleTask: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("google-tasks:delete", taskId),
  getGoogleTasksFilters: (moduleId: string): Promise<string[] | null> =>
    ipcRenderer.invoke("google-tasks:get-filters", moduleId),
  saveGoogleTasksFilters: (moduleId: string, filters: string[]): Promise<void> =>
    ipcRenderer.invoke("google-tasks:save-filters", moduleId, filters),
  isGoogleCalendarAuthenticated: (): Promise<boolean> =>
    ipcRenderer.invoke("google-calendar:is-authenticated"),
  authenticateGoogleCalendar: (): Promise<void> =>
    ipcRenderer.invoke("google-calendar:authenticate"),
  disconnectGoogleCalendar: (): Promise<void> => ipcRenderer.invoke("google-calendar:disconnect"),
  listGoogleCalendarEvents: (): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke("google-calendar:list-events"),
  listGoogleCalendarEventsInRange: (timeMin: string, timeMax: string): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke("google-calendar:list-events-range", timeMin, timeMax),
  getWeatherLocation: (moduleId: string): Promise<string> =>
    ipcRenderer.invoke("weather:get-location", moduleId),
  getAllWeatherLocations: (): Promise<WeatherLocationsState> =>
    ipcRenderer.invoke("weather:get-all-locations"),
  saveWeatherLocation: (moduleId: string, location: string): Promise<void> =>
    ipcRenderer.invoke("weather:save-location", moduleId, location),
  getWeatherForecast: (location: string): Promise<WeatherForecast> =>
    ipcRenderer.invoke("weather:get-forecast", location),
  getRssSettings: (moduleId: string): Promise<RssModuleSettings> =>
    ipcRenderer.invoke("rss:get-settings", moduleId),
  saveRssSettings: (moduleId: string, settings: RssModuleSettings): Promise<void> =>
    ipcRenderer.invoke("rss:save-settings", moduleId, settings),
  getRssItems: (moduleId: string): Promise<RssFetchResult> =>
    ipcRenderer.invoke("rss:get-items", moduleId),
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
  onFlushBeforeQuit: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:flush-before-quit", listener);
    return () => ipcRenderer.removeListener("app:flush-before-quit", listener);
  },
  notifyFlushComplete: (): void => {
    ipcRenderer.send("app:flush-complete");
  },
});
