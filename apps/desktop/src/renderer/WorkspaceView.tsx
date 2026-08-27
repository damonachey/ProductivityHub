import { useState } from "react";
import type { RefreshIntervalsMinutes, Workspace } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { MODULE_REGISTRY, getModuleDefinition } from "./modules/registry";
import { useCachedData } from "./useCachedData";

const GITHUB_PROFILE_CACHE_KEY = "github-profile-url";

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
  if (type === "stock-quotes") {
    return "https://finance.yahoo.com";
  }
  if (type === "gmail-inbox") {
    return "https://mail.google.com/mail/u/0/#inbox";
  }
  if (type === "google-tasks") {
    return "https://tasks.google.com/tasks/";
  }
  if (type === "google-calendar-list") {
    return "https://calendar.google.com/calendar/";
  }
  return undefined;
}

interface Props {
  workspace: Workspace;
  onAddModule: (type: string) => void;
  onRemoveModule: (moduleId: string) => void;
  onReorderModule: (draggedId: string, targetId: string) => void;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
}

export function WorkspaceView({
  workspace,
  onAddModule,
  onRemoveModule,
  onReorderModule,
  lockLayout,
  refreshIntervalsMinutes,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [removeCandidate, setRemoveCandidate] = useState<{ id: string; title: string } | null>(
    null,
  );
  const { data: githubProfileUrl } = useCachedData<string>(
    GITHUB_PROFILE_CACHE_KEY,
    refreshIntervalsMinutes.githubProfileUrl * 60_000,
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
            <div
              className={[
                "module-card",
                moduleInstance.id === draggedModuleId && "dragging",
                moduleInstance.id === dragOverModuleId && "drag-over",
              ]
                .filter(Boolean)
                .join(" ")}
              key={moduleInstance.id}
            >
              <div
                className="module-card-header"
                draggable={!lockLayout}
                onDragStart={() => setDraggedModuleId(moduleInstance.id)}
                onDragEnd={() => {
                  setDraggedModuleId(null);
                  setDragOverModuleId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedModuleId && draggedModuleId !== moduleInstance.id) {
                    setDragOverModuleId(moduleInstance.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedModuleId && draggedModuleId !== moduleInstance.id) {
                    onReorderModule(draggedModuleId, moduleInstance.id);
                  }
                  setDraggedModuleId(null);
                  setDragOverModuleId(null);
                }}
              >
                {titleUrl ? (
                  <a href={titleUrl} target="_blank" rel="noreferrer" draggable={false}>
                    {definition.title}
                  </a>
                ) : (
                  <span>{definition.title}</span>
                )}
                {!lockLayout && (
                  <button
                    aria-label={`Remove ${definition.title}`}
                    onClick={() =>
                      setRemoveCandidate({ id: moduleInstance.id, title: definition.title })
                    }
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="module-card-body">
                <Component
                  moduleId={moduleInstance.id}
                  lockLayout={lockLayout}
                  refreshIntervalsMinutes={refreshIntervalsMinutes}
                />
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

      {removeCandidate && (
        <ConfirmDialog
          message={`Remove the "${removeCandidate.title}" module?`}
          confirmLabel="Remove"
          onConfirm={() => {
            onRemoveModule(removeCandidate.id);
            setRemoveCandidate(null);
          }}
          onCancel={() => setRemoveCandidate(null)}
        />
      )}
    </div>
  );
}
