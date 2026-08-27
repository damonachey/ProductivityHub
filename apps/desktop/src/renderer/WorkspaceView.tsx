import { useCallback, useState } from "react";
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
  if (type === "google-calendar-list" || type === "google-calendar-grid") {
    return "https://calendar.google.com/calendar/";
  }
  return undefined;
}

interface Props {
  workspace: Workspace;
  onAddModule: (type: string) => void;
  onRemoveModule: (moduleId: string) => void;
  onRenameModule: (moduleId: string, title: string) => void;
  onReorderModule: (draggedId: string, targetId: string) => void;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
}

export function WorkspaceView({
  workspace,
  onAddModule,
  onRemoveModule,
  onRenameModule,
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
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  // Per-instance override for the card header link, set by modules whose
  // title target depends on their own configured state (e.g. Weather
  // linking to whatever location it's currently showing).
  const [titleUrlOverrides, setTitleUrlOverrides] = useState<Record<string, string | null>>({});
  const handleTitleUrlChange = useCallback((moduleId: string, url: string | null) => {
    setTitleUrlOverrides((prev) => (prev[moduleId] === url ? prev : { ...prev, [moduleId]: url }));
  }, []);
  const { data: githubProfileUrl } = useCachedData<string>(
    GITHUB_PROFILE_CACHE_KEY,
    refreshIntervalsMinutes.githubProfileUrl * 60_000,
    () => window.api.getGithubProfileUrl(),
  );

  const filteredModules = MODULE_REGISTRY.filter((definition) =>
    definition.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  function startEditingTitle(moduleId: string, currentTitle: string): void {
    setEditingModuleId(moduleId);
    setDraftTitle(currentTitle);
  }

  function commitTitle(): void {
    if (editingModuleId) {
      onRenameModule(editingModuleId, draftTitle.trim());
    }
    setEditingModuleId(null);
  }

  return (
    <div className="workspace-view">
      <div className="module-grid">
        {workspace.modules.map((moduleInstance) => {
          const definition = getModuleDefinition(moduleInstance.type);
          if (!definition) return null;
          const { Component } = definition;
          const displayTitle = moduleInstance.title || definition.title;
          const titleUrl =
            titleUrlOverrides[moduleInstance.id] ?? getTitleUrl(moduleInstance.type, githubProfileUrl);
          const isEditingTitle = editingModuleId === moduleInstance.id;

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
                {isEditingTitle ? (
                  <input
                    className="module-title-rename-input"
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={(event) => event.target.select()}
                    onBlur={commitTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitTitle();
                      if (event.key === "Escape") setEditingModuleId(null);
                    }}
                  />
                ) : titleUrl ? (
                  <a href={titleUrl} target="_blank" rel="noreferrer" draggable={false}>
                    {displayTitle}
                  </a>
                ) : (
                  <span>{displayTitle}</span>
                )}
                <div className="module-card-header-actions">
                  {!lockLayout && (
                    <button
                      aria-label={`Rename ${displayTitle}`}
                      onClick={() => startEditingTitle(moduleInstance.id, displayTitle)}
                    >
                      ✎
                    </button>
                  )}
                  {!lockLayout && (
                    <button
                      aria-label={`Remove ${displayTitle}`}
                      onClick={() => setRemoveCandidate({ id: moduleInstance.id, title: displayTitle })}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="module-card-body">
                <Component
                  moduleId={moduleInstance.id}
                  lockLayout={lockLayout}
                  refreshIntervalsMinutes={refreshIntervalsMinutes}
                  onTitleUrlChange={(url) => handleTitleUrlChange(moduleInstance.id, url)}
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
