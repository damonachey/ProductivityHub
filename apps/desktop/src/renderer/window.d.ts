import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { SlashdotHeadline } from "@productivityhub/slashdot";
import type { HackerNewsStory } from "@productivityhub/hackernews";
import type { FreshRssItem } from "@productivityhub/freshrss";
import type { Candle, StockQuote } from "@productivityhub/yahoo-finance";
import type { GmailThreadSummary } from "@productivityhub/google-mail";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  NotesState,
  Rect,
  StockItem,
  StocksState,
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
      getWebPageUrl: (moduleId: string) => Promise<string>;
      syncWebPage: (moduleId: string, bounds: Rect) => Promise<void>;
      hideWebPage: (moduleId: string) => Promise<void>;
      navigateWebPage: (moduleId: string, pageUrl: string) => Promise<void>;
      webPageGoBack: (moduleId: string) => Promise<void>;
      webPageGoForward: (moduleId: string) => Promise<void>;
      webPageReload: (moduleId: string) => Promise<void>;
      onWebPageNavigated: (callback: (moduleId: string, pageUrl: string) => void) => () => void;
    };
  }
}

export {};
