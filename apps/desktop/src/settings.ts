import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CONFIG_DIR, readJson, writeJson } from "@productivityhub/core";
import type {
  AppSettings,
  BookmarksState,
  GithubIssuesState,
  GoogleTasksFiltersState,
  NotesState,
  RssModuleSettings,
  RssState,
  StockChartsState,
  StocksState,
  WeatherLocationsState,
  WebPagesState,
  WorkspaceState,
} from "./types.js";
import { DEFAULT_REFRESH_INTERVALS_MINUTES } from "./types.js";

export const CURRENT_SCHEMA_VERSION = 1;
export const STATE_FILE = path.join(CONFIG_DIR, "settings.json");

export interface StateFile {
  schemaVersion: number;
  workspaces: WorkspaceState;
  settings: AppSettings;
  notes: NotesState;
  bookmarks: BookmarksState;
  webpages: WebPagesState;
  stocks: StocksState;
  stockCharts: StockChartsState;
  googleTasksFilters: GoogleTasksFiltersState;
  weatherLocations: WeatherLocationsState;
  rss: RssState;
  githubIssues: GithubIssuesState;
}

const DEFAULT_RSS_SETTINGS: RssModuleSettings = { feeds: [], maxItems: 30, maxAgeDays: 14 };

const DEFAULT_SETTINGS: AppSettings = {
  rememberActiveTab: true,
  lockLayout: false,
  showLinkUrl: false,
  refreshIntervalsMinutes: DEFAULT_REFRESH_INTERVALS_MINUTES,
};

function emptyStateFile(): StateFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaces: { activeId: "", workspaces: [] },
    settings: DEFAULT_SETTINGS,
    notes: {},
    bookmarks: {},
    webpages: {},
    stocks: {},
    stockCharts: {},
    googleTasksFilters: {},
    weatherLocations: {},
    rss: {},
    githubIssues: {},
  };
}

// Shallow-merged over defaults so a settings.json written before a new
// top-level section existed (e.g. an older install missing `githubIssues`)
// still gets a valid empty section instead of `undefined`.
export function readState(): StateFile {
  return { ...emptyStateFile(), ...readJson<Partial<StateFile>>(STATE_FILE, {}) };
}

export function writeState(state: StateFile): void {
  writeJson(STATE_FILE, state);
}

function updateState(mutate: (state: StateFile) => void): void {
  const current = readState();
  mutate(current);
  writeState(current);
}

// First run only (settings.json genuinely doesn't exist yet - not just
// unreadable/corrupt) - seeds a starter 3-tab layout, along with the
// companion per-module-instance data those modules read their own state
// from, so it shows real configured content immediately rather than empty
// "set a location"/"add a bookmark" placeholders.
function buildDefaultStateFile(): StateFile {
  const weatherModuleId = randomUUID();
  const bookmarksModuleId = randomUUID();
  const notesModuleId = randomUUID();
  const hackernewsModuleId = randomUUID();
  const slashdotModuleId = randomUUID();
  const stockQuotesModuleId = randomUUID();
  const stockChartSpyModuleId = randomUUID();
  const stockChartQqqModuleId = randomUUID();
  const homeId = randomUUID();

  const state = emptyStateFile();

  state.weatherLocations[weatherModuleId] = "Denver, CO";
  state.bookmarks[bookmarksModuleId] = [
    {
      id: randomUUID(),
      url: "https://github.com/damonachey/ProductivityHub",
      title: "ProductivityHub on GitHub",
    },
    { id: randomUUID(), url: "https://achey.net", title: "achey.net" },
  ];
  state.notes[notesModuleId] = [
    "Locking/unlocking the layout:",
    "Open Settings (the ⚙ icon, top right, or Ctrl+,) and toggle \"Lock layout\".",
    "",
    "Unlocked: drag modules to reorder them, remove or rename a module's title, and use \"+ Add module\" to add new ones.",
    "Locked: the layout stays fixed - routine actions (marking mail read, completing tasks, etc) still work.",
  ].join("\n");
  state.stocks[stockQuotesModuleId] = ["SPY", "QQQ", "AAPL", "AMZN", "MSFT", "GOOG", "NVDA"].map(
    (symbol) => ({ id: randomUUID(), symbol }),
  );
  state.stockCharts[stockChartSpyModuleId] = "SPY";
  state.stockCharts[stockChartQqqModuleId] = "QQQ";

  state.workspaces = {
    activeId: homeId,
    workspaces: [
      {
        id: homeId,
        name: "Home",
        modules: [
          { id: weatherModuleId, type: "weather" },
          { id: bookmarksModuleId, type: "bookmarks" },
          { id: notesModuleId, type: "notes" },
        ],
      },
      {
        id: randomUUID(),
        name: "News",
        modules: [
          { id: hackernewsModuleId, type: "hackernews" },
          { id: slashdotModuleId, type: "slashdot" },
        ],
      },
      {
        id: randomUUID(),
        name: "Markets",
        modules: [
          { id: stockQuotesModuleId, type: "stock-quotes" },
          { id: stockChartSpyModuleId, type: "stock-chart" },
          { id: stockChartQqqModuleId, type: "stock-chart" },
        ],
      },
    ],
  };

  return state;
}

export function getWorkspaceState(): WorkspaceState {
  if (!fs.existsSync(STATE_FILE)) {
    const seeded = buildDefaultStateFile();
    writeState(seeded);
    return seeded.workspaces;
  }
  return readState().workspaces;
}

export function saveWorkspaceState(state: WorkspaceState): void {
  updateState((s) => {
    s.workspaces = state;
  });
}

export function getSettings(): AppSettings {
  const stored = readState().settings as Partial<AppSettings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    refreshIntervalsMinutes: {
      ...DEFAULT_REFRESH_INTERVALS_MINUTES,
      ...stored?.refreshIntervalsMinutes,
    },
  };
}

export function saveSettings(settings: AppSettings): void {
  updateState((s) => {
    s.settings = settings;
  });
}

export function getNotes(): NotesState {
  return readState().notes;
}

export function saveNote(moduleId: string, text: string): void {
  updateState((s) => {
    s.notes[moduleId] = text;
  });
}

export function getBookmarks(): BookmarksState {
  return readState().bookmarks;
}

export function saveBookmarks(moduleId: string, items: BookmarksState[string]): void {
  updateState((s) => {
    s.bookmarks[moduleId] = items;
  });
}

export function getStocks(): StocksState {
  return readState().stocks;
}

export function saveStocks(moduleId: string, items: StocksState[string]): void {
  updateState((s) => {
    s.stocks[moduleId] = items;
  });
}

export function getStockCharts(): StockChartsState {
  return readState().stockCharts;
}

export function saveStockChartSymbol(moduleId: string, symbol: string): void {
  updateState((s) => {
    s.stockCharts[moduleId] = symbol;
  });
}

export function getGoogleTasksFilters(): GoogleTasksFiltersState {
  return readState().googleTasksFilters;
}

export function saveGoogleTasksFilters(moduleId: string, filters: string[]): void {
  updateState((s) => {
    s.googleTasksFilters[moduleId] = filters;
  });
}

export function getWeatherLocations(): WeatherLocationsState {
  return readState().weatherLocations;
}

export function saveWeatherLocation(moduleId: string, location: string): void {
  updateState((s) => {
    s.weatherLocations[moduleId] = location;
  });
}

export function getGithubIssuesRepos(): GithubIssuesState {
  return readState().githubIssues;
}

export function saveGithubIssuesRepo(moduleId: string, repoPath: string): void {
  updateState((s) => {
    s.githubIssues[moduleId] = repoPath;
  });
}

export function getRssState(): RssState {
  return readState().rss;
}

export function getRssSettings(moduleId: string): RssModuleSettings {
  return getRssState()[moduleId] ?? DEFAULT_RSS_SETTINGS;
}

export function saveRssSettings(moduleId: string, settings: RssModuleSettings): void {
  updateState((s) => {
    s.rss[moduleId] = settings;
  });
}

export function getWebPages(): WebPagesState {
  return readState().webpages;
}

export function saveWebPages(pages: WebPagesState): void {
  updateState((s) => {
    s.webpages = pages;
  });
}

export function saveWebPageUrl(moduleId: string, pageUrl: string): void {
  updateState((s) => {
    s.webpages[moduleId] = pageUrl;
  });
}

// Best-effort defaulting for a possibly partial/older imported document: any
// missing or malformed section falls back to its empty default rather than
// rejecting the whole import.
export function validateAndNormalizeImportedState(
  parsed: unknown,
): { ok: true; state: StateFile } | { ok: false; error: string } {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "File does not contain a valid configuration object." };
  }

  const candidate = parsed as Partial<StateFile>;
  if (typeof candidate.schemaVersion === "number" && candidate.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This file was exported by a newer version of ProductivityHub (schema ${candidate.schemaVersion}, this app supports up to ${CURRENT_SCHEMA_VERSION}).`,
    };
  }

  const defaults = emptyStateFile();
  const workspaces =
    candidate.workspaces && Array.isArray(candidate.workspaces.workspaces)
      ? candidate.workspaces
      : defaults.workspaces;

  return {
    ok: true,
    state: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      workspaces,
      settings: candidate.settings ?? defaults.settings,
      notes: candidate.notes ?? defaults.notes,
      bookmarks: candidate.bookmarks ?? defaults.bookmarks,
      webpages: candidate.webpages ?? defaults.webpages,
      stocks: candidate.stocks ?? defaults.stocks,
      stockCharts: candidate.stockCharts ?? defaults.stockCharts,
      googleTasksFilters: candidate.googleTasksFilters ?? defaults.googleTasksFilters,
      weatherLocations: candidate.weatherLocations ?? defaults.weatherLocations,
      rss: candidate.rss ?? defaults.rss,
      githubIssues: candidate.githubIssues ?? defaults.githubIssues,
    },
  };
}
