export interface ModuleInstance {
  id: string;
  type: string;
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
  slashdot: number;
  hackernews: number;
  freshrss: number;
  stockQuotes: number;
  stockChart: number;
  gmailInbox: number;
}

// Shared with the renderer so a settings.json missing some (or all) of
// these keys - including a first run with no file at all - still gets a
// sane refresh cadence for every module.
export const DEFAULT_REFRESH_INTERVALS_MINUTES: RefreshIntervalsMinutes = {
  githubRepos: 5,
  githubNotifications: 1,
  githubProfileUrl: 60,
  slashdot: 15,
  hackernews: 15,
  freshrss: 5,
  stockQuotes: 5,
  stockChart: 15,
  gmailInbox: 2,
};

export interface AppSettings {
  rememberActiveTab: boolean;
  lockLayout: boolean;
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
