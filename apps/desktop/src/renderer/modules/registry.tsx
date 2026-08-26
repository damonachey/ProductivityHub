import type { ComponentType } from "react";
import { GithubReposModule } from "./GithubReposModule";
import { GithubNotificationsModule } from "./GithubNotificationsModule";
import { NotesModule } from "./NotesModule";
import { SlashdotModule } from "./SlashdotModule";
import { HackerNewsModule } from "./HackerNewsModule";
import { PlaceholderModule } from "./PlaceholderModule";
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
  { type: "slashdot", title: "Slashdot", Component: SlashdotModule },
  { type: "hackernews", title: "Hacker News", Component: HackerNewsModule },
  {
    type: "gmail-inbox",
    title: "Gmail Inbox",
    Component: () => <PlaceholderModule title="Gmail Inbox" />,
  },
  {
    type: "google-tasks",
    title: "Google Tasks",
    Component: () => <PlaceholderModule title="Google Tasks" />,
  },
  {
    type: "google-calendar",
    title: "Google Calendar",
    Component: () => <PlaceholderModule title="Google Calendar" />,
  },
];

export const MODULE_REGISTRY: ModuleDefinition[] = [...MODULE_DEFINITIONS].sort((a, b) =>
  a.title.localeCompare(b.title),
);

export function getModuleDefinition(type: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((definition) => definition.type === type);
}
