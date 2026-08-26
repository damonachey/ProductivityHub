import type { ComponentType } from "react";
import { GithubReposModule } from "./GithubReposModule";
import { PlaceholderModule } from "./PlaceholderModule";

export interface ModuleDefinition {
  type: string;
  title: string;
  Component: ComponentType;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  { type: "github-repos", title: "GitHub Repos", Component: GithubReposModule },
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

export function getModuleDefinition(type: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((definition) => definition.type === type);
}
