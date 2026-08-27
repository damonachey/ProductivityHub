import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { SlashdotHeadline } from "@productivityhub/slashdot";
import type { HackerNewsStory } from "@productivityhub/hackernews";
import type { FreshRssItem } from "@productivityhub/freshrss";
import type { Candle, StockQuote } from "@productivityhub/yahoo-finance";
import type { GmailThreadSummary } from "@productivityhub/google-mail";
import type { CreateTaskInput, GoogleTask } from "@productivityhub/google-tasks";
import type { CalendarEvent } from "@productivityhub/google-calendar";
import type { WeatherForecast } from "@productivityhub/open-meteo";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  NotesState,
  Rect,
  StockChartsState,
  StockItem,
  StocksState,
  WeatherLocationsState,
  WorkspaceState,
} from "../types";

declare global {
  interface Window {
    api: {
      listRepos: () => Promise<RepoSummary[]>;
      listNotifications: () => Promise<NotificationSummary[]>;
      getGithubProfileUrl: () => Promise<string>;
      getSlashdotHeadlines: () => Promise<SlashdotHeadline[]>;
      getHackerNewsStories: () => Promise<HackerNewsStory[]>;
      getFreshRssUnread: () => Promise<FreshRssItem[]>;
      getWorkspaces: () => Promise<WorkspaceState>;
      saveWorkspaces: (state: WorkspaceState) => Promise<void>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<void>;
      getNotes: () => Promise<NotesState>;
      saveNote: (moduleId: string, text: string) => Promise<void>;
      getBookmarks: () => Promise<BookmarksState>;
      saveBookmarks: (moduleId: string, items: BookmarkItem[]) => Promise<void>;
      getStocks: () => Promise<StocksState>;
      saveStocks: (moduleId: string, items: StockItem[]) => Promise<void>;
      getStockQuotes: (symbols: string[]) => Promise<StockQuote[]>;
      getStockChartSymbol: (moduleId: string) => Promise<string>;
      getAllStockChartSymbols: () => Promise<StockChartsState>;
      saveStockChartSymbol: (moduleId: string, symbol: string) => Promise<void>;
      getStockCandles: (symbol: string) => Promise<Candle[]>;
      isGmailAuthenticated: () => Promise<boolean>;
      authenticateGmail: () => Promise<void>;
      disconnectGmail: () => Promise<void>;
      listGmailThreads: () => Promise<GmailThreadSummary[]>;
      markGmailThreadRead: (threadId: string) => Promise<void>;
      markGmailThreadUnread: (threadId: string) => Promise<void>;
      archiveGmailThread: (threadId: string) => Promise<void>;
      trashGmailThread: (threadId: string) => Promise<void>;
      isGoogleTasksAuthenticated: () => Promise<boolean>;
      authenticateGoogleTasks: () => Promise<void>;
      disconnectGoogleTasks: () => Promise<void>;
      listGoogleTasks: () => Promise<GoogleTask[]>;
      createGoogleTask: (input: CreateTaskInput) => Promise<GoogleTask>;
      setGoogleTaskStatus: (taskId: string, status: "needsAction" | "completed") => Promise<void>;
      deleteGoogleTask: (taskId: string) => Promise<void>;
      getGoogleTasksFilters: (moduleId: string) => Promise<string[] | null>;
      saveGoogleTasksFilters: (moduleId: string, filters: string[]) => Promise<void>;
      isGoogleCalendarAuthenticated: () => Promise<boolean>;
      authenticateGoogleCalendar: () => Promise<void>;
      disconnectGoogleCalendar: () => Promise<void>;
      listGoogleCalendarEvents: () => Promise<CalendarEvent[]>;
      listGoogleCalendarEventsInRange: (timeMin: string, timeMax: string) => Promise<CalendarEvent[]>;
      getWeatherLocation: (moduleId: string) => Promise<string>;
      getAllWeatherLocations: () => Promise<WeatherLocationsState>;
      saveWeatherLocation: (moduleId: string, location: string) => Promise<void>;
      getWeatherForecast: (location: string) => Promise<WeatherForecast>;
      getWebPageUrl: (moduleId: string) => Promise<string>;
      syncWebPage: (moduleId: string, bounds: Rect) => Promise<void>;
      hideWebPage: (moduleId: string) => Promise<void>;
      navigateWebPage: (moduleId: string, pageUrl: string) => Promise<void>;
      webPageGoBack: (moduleId: string) => Promise<void>;
      webPageGoForward: (moduleId: string) => Promise<void>;
      webPageReload: (moduleId: string) => Promise<void>;
      onWebPageNavigated: (callback: (moduleId: string, pageUrl: string) => void) => () => void;
      onFlushBeforeQuit: (callback: () => void) => () => void;
      notifyFlushComplete: () => void;
    };
  }
}

export {};
