export interface ModuleInstance {
  id: string;
  type: string;
  // User-set override for the card header title (e.g. distinguishing two
  // Weather modules for different cities). Falls back to the registry's
  // per-type default title when unset.
  title?: string;
}

export interface Workspace {
  id: string;
  name: string;
  modules: ModuleInstance[];
}

export interface WorkspaceState {
  activeId: string;
  workspaces: Workspace[];
}

export interface RefreshIntervalsMinutes {
  githubRepos: number;
  githubNotifications: number;
  githubProfileUrl: number;
  githubIssues: number;
  slashdot: number;
  hackernews: number;
  freshrss: number;
  stockQuotes: number;
  stockChart: number;
  gmailInbox: number;
  googleTasks: number;
  googleCalendarList: number;
  googleCalendarGrid: number;
  weather: number;
  rss: number;
}

// Shared with the renderer so a settings.json missing some (or all) of
// these keys - including a first run with no file at all - still gets a
// sane refresh cadence for every module.
export const DEFAULT_REFRESH_INTERVALS_MINUTES: RefreshIntervalsMinutes = {
  githubRepos: 5,
  githubNotifications: 1,
  githubProfileUrl: 60,
  githubIssues: 5,
  slashdot: 15,
  hackernews: 15,
  freshrss: 5,
  stockQuotes: 5,
  stockChart: 5,
  gmailInbox: 1,
  googleTasks: 5,
  googleCalendarList: 5,
  googleCalendarGrid: 5,
  weather: 15,
  rss: 60,
};

export interface AppSettings {
  rememberActiveTab: boolean;
  lockLayout: boolean;
  showLinkUrl: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
}

// Keyed by module instance id, so each Notes module instance keeps its own
// independent text.
export type NotesState = Record<string, string>;

export interface BookmarkItem {
  id: string;
  url: string;
  title?: string;
}

// Keyed by module instance id, so each Bookmarks module instance keeps its
// own independent, ordered list.
export type BookmarksState = Record<string, BookmarkItem[]>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Keyed by module instance id: the last-navigated URL, so a Web Page module
// resumes where it left off across app restarts.
export type WebPagesState = Record<string, string>;

export interface StockItem {
  id: string;
  symbol: string;
}

// Keyed by module instance id, so each Stock Quotes module instance keeps
// its own independent, ordered watchlist.
export type StocksState = Record<string, StockItem[]>;

// Keyed by module instance id: the configured symbol for a Stock Chart
// module instance.
export type StockChartsState = Record<string, string>;

// Shared by Stock Quotes and Stock Chart: which site a symbol's link
// points to.
export type StockLinkTarget = "yahoo" | "finviz" | "tradingview";

// Keyed by module instance id (shared between Stock Quotes and Stock
// Chart instances, since module instance ids are globally unique).
export type StockLinkTargetsState = Record<string, StockLinkTarget>;

// Keyed by module instance id, so each Google Tasks module instance keeps
// its own independent set of selected due-date filters (e.g.
// ["pastDue", "today", "tomorrow"]).
export type GoogleTasksFiltersState = Record<string, string[]>;

// Keyed by module instance id: the configured location (zip, "City, State",
// or PWS station id) for a Weather module instance.
export type WeatherLocationsState = Record<string, string>;

export interface RssFeedConfig {
  id: string;
  url: string;
  title?: string;
}

export interface RssModuleSettings {
  feeds: RssFeedConfig[];
  maxItems: number;
  maxAgeDays: number;
}

// Keyed by module instance id, so each RSS module instance keeps its own
// independent feed list and item limits.
export type RssState = Record<string, RssModuleSettings>;

// Keyed by module instance id: the configured repo ("owner/repo") for a
// GitHub Issues module instance.
export type GithubIssuesState = Record<string, string>;
