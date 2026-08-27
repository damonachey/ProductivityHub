import type { Workspace } from "../types";
import { getCached } from "./cache";
import { getModuleDefinition } from "./modules/registry";

// Gmail/Tasks/Calendar have no local persisted file - their content only
// exists in memory while that specific module instance is mounted (i.e. its
// workspace tab is the active one). Each of those modules writes its last
// fetch into the shared renderer cache under these keys so a search can
// still find it after the tab is switched away from, as long as it was
// loaded at least once this session.
export function gmailInboxCacheKey(moduleId: string): string {
  return `search-gmail-inbox-${moduleId}`;
}

export function googleTasksCacheKey(moduleId: string): string {
  return `search-google-tasks-${moduleId}`;
}

export function googleCalendarListCacheKey(moduleId: string): string {
  return `search-google-calendar-list-${moduleId}`;
}

export function googleCalendarGridCacheKey(moduleId: string): string {
  return `search-google-calendar-grid-${moduleId}`;
}

// Slashdot/HackerNews/FreshRSS have no per-module config, so every instance
// of a given type shares one cache entry - these are the same literal keys
// each module's useCachedData call already caches its result under.
export const SLASHDOT_CACHE_KEY = "slashdot-headlines";
export const HACKERNEWS_CACHE_KEY = "hackernews-stories";
export const FRESHRSS_CACHE_KEY = "freshrss-unread";

export interface SearchItem {
  workspaceId: string;
  workspaceName: string;
  moduleId: string | null;
  moduleTitle: string;
  category: string;
  snippet: string;
  haystack: string;
}

interface GmailCacheEntry {
  subject: string;
  from: string;
  snippet: string;
}

interface TaskCacheEntry {
  title: string;
  notes: string | null;
}

interface EventCacheEntry {
  title: string;
  location: string | null;
}

interface SlashdotCacheEntry {
  title: string;
  creator: string | null;
}

interface HackerNewsCacheEntry {
  title: string;
  author: string;
}

interface FreshRssCacheEntry {
  title: string;
  feedTitle: string;
}

function moduleDisplayTitle(type: string, title: string | undefined): string {
  if (title) return title;
  return getModuleDefinition(type)?.title ?? type;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

// Gathers everything searchable right now: workspace/module names (always
// available), notes/stocks/stock-chart-symbols/weather-locations (persisted,
// fetched in bulk), and Gmail/Tasks/Calendar (whatever's in the shared cache
// from a module that's been mounted this session - see the cache-key
// functions above).
export async function buildSearchIndex(workspaces: Workspace[]): Promise<SearchItem[]> {
  const [notes, stocks, chartSymbols, weatherLocations] = await Promise.all([
    window.api.getNotes(),
    window.api.getStocks(),
    window.api.getAllStockChartSymbols(),
    window.api.getAllWeatherLocations(),
  ]);

  const items: SearchItem[] = [];

  for (const workspace of workspaces) {
    items.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      moduleId: null,
      moduleTitle: workspace.name,
      category: "Tab",
      snippet: workspace.name,
      haystack: workspace.name,
    });

    for (const module of workspace.modules) {
      const moduleTitle = moduleDisplayTitle(module.type, module.title);

      items.push({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        moduleId: module.id,
        moduleTitle,
        category: "Module",
        snippet: moduleTitle,
        haystack: moduleTitle,
      });

      if (module.type === "notes") {
        const text = notes[module.id];
        if (text) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Note",
            snippet: truncate(text, 80),
            haystack: text,
          });
        }
      }

      if (module.type === "stock-quotes") {
        for (const item of stocks[module.id] ?? []) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Stock",
            snippet: item.symbol,
            haystack: item.symbol,
          });
        }
      }

      if (module.type === "stock-chart") {
        const symbol = chartSymbols[module.id];
        if (symbol) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Chart",
            snippet: symbol,
            haystack: symbol,
          });
        }
      }

      if (module.type === "weather") {
        const location = weatherLocations[module.id];
        if (location) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Weather",
            snippet: location,
            haystack: location,
          });
        }
      }

      if (module.type === "gmail-inbox") {
        const threads = getCached<GmailCacheEntry[]>(gmailInboxCacheKey(module.id)) ?? [];
        for (const thread of threads) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Email",
            snippet: thread.subject || thread.from,
            haystack: `${thread.subject} ${thread.from} ${thread.snippet}`,
          });
        }
      }

      if (module.type === "google-tasks") {
        const tasks = getCached<TaskCacheEntry[]>(googleTasksCacheKey(module.id)) ?? [];
        for (const task of tasks) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Task",
            snippet: task.title,
            haystack: `${task.title} ${task.notes ?? ""}`,
          });
        }
      }

      if (module.type === "google-calendar-list" || module.type === "google-calendar-grid") {
        const cacheKey =
          module.type === "google-calendar-list"
            ? googleCalendarListCacheKey(module.id)
            : googleCalendarGridCacheKey(module.id);
        const events = getCached<EventCacheEntry[]>(cacheKey) ?? [];
        for (const event of events) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Event",
            snippet: event.title,
            haystack: `${event.title} ${event.location ?? ""}`,
          });
        }
      }

      if (module.type === "slashdot") {
        const headlines = getCached<SlashdotCacheEntry[]>(SLASHDOT_CACHE_KEY) ?? [];
        for (const headline of headlines) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Headline",
            snippet: headline.title,
            haystack: `${headline.title} ${headline.creator ?? ""}`,
          });
        }
      }

      if (module.type === "hackernews") {
        const stories = getCached<HackerNewsCacheEntry[]>(HACKERNEWS_CACHE_KEY) ?? [];
        for (const story of stories) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Story",
            snippet: story.title,
            haystack: `${story.title} ${story.author}`,
          });
        }
      }

      if (module.type === "freshrss") {
        const feedItems = getCached<FreshRssCacheEntry[]>(FRESHRSS_CACHE_KEY) ?? [];
        for (const feedItem of feedItems) {
          items.push({
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            moduleId: module.id,
            moduleTitle,
            category: "Article",
            snippet: feedItem.title,
            haystack: `${feedItem.title} ${feedItem.feedTitle}`,
          });
        }
      }
    }
  }

  return items;
}

export interface SearchResult extends SearchItem {
  key: string;
}

const MAX_RESULTS = 40;

export function filterSearchIndex(index: SearchItem[], query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const results: SearchResult[] = [];
  for (let i = 0; i < index.length && results.length < MAX_RESULTS; i++) {
    const item = index[i];
    if (item.haystack.toLowerCase().includes(normalized)) {
      results.push({ ...item, key: `${item.category}-${item.moduleId ?? item.workspaceId}-${i}` });
    }
  }
  return results;
}
