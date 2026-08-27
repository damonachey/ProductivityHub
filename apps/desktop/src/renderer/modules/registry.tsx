import type { ComponentType } from "react";
import { GithubReposModule } from "./GithubReposModule";
import { GithubNotificationsModule } from "./GithubNotificationsModule";
import { NotesModule } from "./NotesModule";
import { BookmarksModule } from "./BookmarksModule";
import { WebPageModule } from "./WebPageModule";
import { SlashdotModule } from "./SlashdotModule";
import { HackerNewsModule } from "./HackerNewsModule";
import { FreshRssModule } from "./FreshRssModule";
import { StockQuotesModule } from "./StockQuotesModule";
import { StockChartModule } from "./StockChartModule";
import { GmailInboxModule } from "./GmailInboxModule";
import { GoogleTasksModule } from "./GoogleTasksModule";
import { GoogleCalendarListModule } from "./GoogleCalendarListModule";
import { GoogleCalendarGridModule } from "./GoogleCalendarGridModule";
import type { ModuleProps } from "./types";

export interface ModuleDefinition {
  type: string;
  title: string;
  Component: ComponentType<ModuleProps>;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { type: "github-repos", title: "GitHub Repos", Component: GithubReposModule },
  {
    type: "github-notifications",
    title: "GitHub Notifications",
    Component: GithubNotificationsModule,
  },
  { type: "notes", title: "Notes", Component: NotesModule },
  { type: "bookmarks", title: "Bookmarks", Component: BookmarksModule },
  { type: "webpage", title: "Web Page", Component: WebPageModule },
  { type: "slashdot", title: "Slashdot", Component: SlashdotModule },
  { type: "hackernews", title: "Hacker News", Component: HackerNewsModule },
  { type: "freshrss", title: "FreshRSS", Component: FreshRssModule },
  { type: "stock-quotes", title: "Stock Quotes", Component: StockQuotesModule },
  { type: "stock-chart", title: "Stock Chart", Component: StockChartModule },
  { type: "gmail-inbox", title: "Gmail Inbox", Component: GmailInboxModule },
  { type: "google-tasks", title: "Google Tasks", Component: GoogleTasksModule },
  {
    type: "google-calendar-list",
    title: "Google Calendar",
    Component: GoogleCalendarListModule,
  },
  {
    type: "google-calendar-grid",
    title: "Google Calendar",
    Component: GoogleCalendarGridModule,
  },
];

export const MODULE_REGISTRY: ModuleDefinition[] = [...MODULE_DEFINITIONS].sort((a, b) =>
  a.title.localeCompare(b.title),
);

export function getModuleDefinition(type: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((definition) => definition.type === type);
}
