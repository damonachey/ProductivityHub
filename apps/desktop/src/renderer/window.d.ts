import type { NotificationSummary, RepoSummary } from "@productivityhub/github";
import type { SlashdotHeadline } from "@productivityhub/slashdot";
import type { HackerNewsStory } from "@productivityhub/hackernews";
import type { FreshRssItem } from "@productivityhub/freshrss";
import type {
  AppSettings,
  BookmarkItem,
  BookmarksState,
  NotesState,
  Rect,
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
