import { useState } from "react";
import type { Workspace } from "../types";
import { MODULE_REGISTRY, getModuleDefinition } from "./modules/registry";
import { useCachedData } from "./useCachedData";

const GITHUB_PROFILE_CACHE_KEY = "github-profile-url";
const GITHUB_PROFILE_CACHE_TTL_MS = 60 * 60 * 1000; // rarely changes

function getTitleUrl(type: string, githubProfileUrl: string | null): string | undefined {
  if (type === "github-repos") {
    return githubProfileUrl ? `${githubProfileUrl}?tab=repositories` : undefined;
  }
  if (type === "github-notifications") {
    return "https://github.com/notifications";
  }
  if (type === "slashdot") {
    return "https://slashdot.org";
  }
  if (type === "hackernews") {
    return "https://news.ycombinator.com";
  }
  if (type === "freshrss") {
    return "http://192.168.0.9/FreshRSS/";
  }
  return undefined;
}

interface Props {
  workspace: Workspace;
  onAddModule: (type: string) => void;
  onRemoveModule: (moduleId: string) => void;
  lockLayout: boolean;
}

export function WorkspaceView({ workspace, onAddModule, onRemoveModule, lockLayout }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: githubProfileUrl } = useCachedData<string>(
    GITHUB_PROFILE_CACHE_KEY,
    GITHUB_PROFILE_CACHE_TTL_MS,
    () => window.api.getGithubProfileUrl(),
  );

  const filteredModules = MODULE_REGISTRY.filter((definition) =>
    definition.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="workspace-view">
      <div className="module-grid">
        {workspace.modules.map((moduleInstance) => {
          const definition = getModuleDefinition(moduleInstance.type);
          if (!definition) return null;
          const { Component } = definition;
          const titleUrl = getTitleUrl(moduleInstance.type, githubProfileUrl);

          return (
            <div className="module-card" key={moduleInstance.id}>
              <div className="module-card-header">
                {titleUrl ? (
                  <a href={titleUrl} target="_blank" rel="noreferrer">
                    {definition.title}
                  </a>
                ) : (
                  <span>{definition.title}</span>
                )}
                {!lockLayout && (
                  <button
                    aria-label={`Remove ${definition.title}`}
                    onClick={() => onRemoveModule(moduleInstance.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="module-card-body">
                <Component moduleId={moduleInstance.id} lockLayout={lockLayout} />
              </div>
            </div>
          );
        })}

        {!lockLayout && (
          <div className="module-card module-card-add">
            {pickerOpen ? (
              <div className="module-picker">
                <input
                  className="module-picker-search"
                  type="text"
                  placeholder="Search modules…"
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setPickerOpen(false);
                  }}
                />
                {filteredModules.length > 0 ? (
                  filteredModules.map((definition) => (
                    <button
                      key={definition.type}
                      onClick={() => {
                        onAddModule(definition.type);
                        setPickerOpen(false);
                      }}
                    >
                      {definition.title}
                    </button>
                  ))
                ) : (
                  <p className="module-picker-empty">No modules match "{searchQuery}".</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPickerOpen(true);
                }}
              >
                + Add module
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
