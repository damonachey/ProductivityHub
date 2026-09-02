import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ModuleDropTarget, RefreshIntervalsMinutes, Workspace } from "../types";
import { DEFAULT_COLUMN_COUNT, MAX_COLUMN_COUNT, MIN_COLUMN_COUNT } from "../types";
import { getCached, setCached } from "./cache";
import { ConfirmDialog } from "./ConfirmDialog";
import { MODULE_REGISTRY, getModuleDefinition } from "./modules/registry";

const GITHUB_PROFILE_CACHE_KEY = "github-profile-url";

// Bounds for the drag-to-resize handle on each module card body.
const MIN_MODULE_HEIGHT = 80;
const MAX_MODULE_HEIGHT = 1600;

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
  onResizeModule: (moduleId: string, height: number | undefined) => void;
  onMoveModule: (draggedId: string, target: ModuleDropTarget) => void;
  onSetColumnCount: (count: number) => void;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
  highlightedModule: { moduleId: string; itemId: string | null; token: number } | null;
}

export function WorkspaceView({
  workspace,
  onAddModule,
  onRemoveModule,
  onRenameModule,
  onResizeModule,
  onMoveModule,
  onSetColumnCount,
  lockLayout,
  refreshIntervalsMinutes,
  highlightedModule,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
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
  // Per-instance override for the card header title text, set by modules
  // whose display name depends on their own configured state (e.g. GitHub
  // Issues appending its configured repo). A user's manual rename (stored
  // on the module instance itself) always wins over this.
  const [titleTextOverrides, setTitleTextOverrides] = useState<Record<string, string | null>>({});
  const handleTitleTextChange = useCallback((moduleId: string, title: string | null) => {
    setTitleTextOverrides((prev) => (prev[moduleId] === title ? prev : { ...prev, [moduleId]: title }));
  }, []);
  const moduleCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const moduleBodyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Live height while a resize drag is in progress, keyed by module id. Kept
  // in local state (not the persisted workspace) so the drag feels immediate
  // and only the final height is written back on pointer-up.
  const [resizingHeight, setResizingHeight] = useState<{ moduleId: string; height: number } | null>(
    null,
  );

  function handleResizeStart(moduleId: string, event: ReactPointerEvent): void {
    event.preventDefault();
    const bodyElement = moduleBodyRefs.current.get(moduleId);
    if (!bodyElement) return;
    const startY = event.clientY;
    const startHeight = bodyElement.getBoundingClientRect().height;

    function clamp(value: number): number {
      return Math.max(MIN_MODULE_HEIGHT, Math.min(MAX_MODULE_HEIGHT, value));
    }

    function onMove(moveEvent: PointerEvent): void {
      setResizingHeight({
        moduleId,
        height: clamp(startHeight + (moveEvent.clientY - startY)),
      });
    }

    function onUp(upEvent: PointerEvent): void {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("module-resizing");
      onResizeModule(moduleId, clamp(startHeight + (upEvent.clientY - startY)));
      setResizingHeight(null);
    }

    document.body.classList.add("module-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Flashes the specific row a search result points at (tagged with
  // data-search-item-id by each module) so the highlight lands on the exact
  // thread/task/event/etc.; falls back to the whole module card when there's
  // no such row (Notes, Weather, Stock Chart) or it isn't cached/rendered.
  useEffect(() => {
    if (!highlightedModule) return;
    const { moduleId, itemId } = highlightedModule;
    const cardElement = moduleCardRefs.current.get(moduleId);
    if (!cardElement) return;

    const itemElement = itemId
      ? cardElement.querySelector<HTMLElement>(`[data-search-item-id="${CSS.escape(itemId)}"]`)
      : null;
    const target = itemElement ?? cardElement;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Force a reflow so re-selecting the same target restarts the animation
    // instead of a no-op (the class would otherwise already be present).
    target.classList.remove("search-highlight");
    void target.offsetWidth;
    target.classList.add("search-highlight");

    const timeoutId = setTimeout(() => target.classList.remove("search-highlight"), 1600);
    return () => {
      clearTimeout(timeoutId);
      target.classList.remove("search-highlight");
    };
  }, [highlightedModule]);

  const hasGithubRepos = workspace.modules.some((module) => module.type === "github-repos");
  const [githubProfileUrl, setGithubProfileUrl] = useState<string | null>(
    () => getCached<string>(GITHUB_PROFILE_CACHE_KEY) ?? null,
  );

  useEffect(() => {
    // Only fetch (and require GITHUB_TOKEN) when a GitHub Repos module is
    // actually present - this used to run unconditionally on every mount,
    // erroring on GITHUB_TOKEN even when no GitHub module was in view.
    if (!hasGithubRepos) return;
    if (getCached<string>(GITHUB_PROFILE_CACHE_KEY) !== undefined) return;

    let cancelled = false;
    window.api
      .getGithubProfileUrl()
      .then((result) => {
        if (cancelled) return;
        setCached(GITHUB_PROFILE_CACHE_KEY, result, refreshIntervalsMinutes.githubProfileUrl * 60_000);
        setGithubProfileUrl(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hasGithubRepos, refreshIntervalsMinutes.githubProfileUrl]);

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

  const columnCount = Math.max(
    MIN_COLUMN_COUNT,
    Math.min(MAX_COLUMN_COUNT, workspace.columnCount ?? DEFAULT_COLUMN_COUNT),
  );

  // Column each module renders in: its explicit `column` once the layout has
  // been arranged by hand, otherwise the legacy `arrayIndex % columnCount`
  // fallback. `index` is the position in `workspace.modules`, which is also
  // the top-to-bottom order within a column.
  function columnOf(moduleInstance: Workspace["modules"][number], index: number): number {
    return Math.max(0, Math.min(columnCount - 1, moduleInstance.column ?? index % columnCount));
  }

  function renderModuleCard(moduleInstance: Workspace["modules"][number]) {
    const definition = getModuleDefinition(moduleInstance.type);
    if (!definition) return null;
    const { Component } = definition;
    const displayTitle =
      moduleInstance.title || titleTextOverrides[moduleInstance.id] || definition.title;
    const titleUrl =
      titleUrlOverrides[moduleInstance.id] ?? getTitleUrl(moduleInstance.type, githubProfileUrl);
    const isEditingTitle = editingModuleId === moduleInstance.id;
    const effectiveHeight =
      resizingHeight?.moduleId === moduleInstance.id ? resizingHeight.height : moduleInstance.height;

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
        ref={(element) => {
          if (element) moduleCardRefs.current.set(moduleInstance.id, element);
          else moduleCardRefs.current.delete(moduleInstance.id);
        }}
      >
        <div
          className="module-card-header"
          draggable={!lockLayout}
          onDragStart={() => setDraggedModuleId(moduleInstance.id)}
          onDragEnd={() => {
            setDraggedModuleId(null);
            setDragOverModuleId(null);
            setDragOverColumn(null);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggedModuleId && draggedModuleId !== moduleInstance.id) {
              setDragOverModuleId(moduleInstance.id);
            }
          }}
          onDragLeave={() => {
            setDragOverModuleId((current) => (current === moduleInstance.id ? null : current));
          }}
          onDrop={(event) => {
            event.preventDefault();
            // Stop the enclosing column's onDrop from also firing and
            // appending the module to the column tail.
            event.stopPropagation();
            if (draggedModuleId && draggedModuleId !== moduleInstance.id) {
              onMoveModule(draggedModuleId, { kind: "before-module", moduleId: moduleInstance.id });
            }
            setDraggedModuleId(null);
            setDragOverModuleId(null);
            setDragOverColumn(null);
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
        <div
          className="module-card-body"
          ref={(element) => {
            if (element) moduleBodyRefs.current.set(moduleInstance.id, element);
            else moduleBodyRefs.current.delete(moduleInstance.id);
          }}
          style={effectiveHeight ? { height: effectiveHeight, maxHeight: "none" } : undefined}
        >
          <Component
            moduleId={moduleInstance.id}
            lockLayout={lockLayout}
            refreshIntervalsMinutes={refreshIntervalsMinutes}
            onTitleUrlChange={(url) => handleTitleUrlChange(moduleInstance.id, url)}
            onTitleTextChange={(title) => handleTitleTextChange(moduleInstance.id, title)}
          />
        </div>
        {!lockLayout && (
          <div
            className="module-card-resize-handle"
            onPointerDown={(event) => handleResizeStart(moduleInstance.id, event)}
            onDoubleClick={() => onResizeModule(moduleInstance.id, undefined)}
            title="Drag to resize · double-click to reset"
          />
        )}
      </div>
    );
  }

  function renderAddTile() {
    return (
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
    );
  }

  return (
    <div className="workspace-view">
      {!lockLayout && (
        <div className="workspace-toolbar">
          <div className="column-stepper" title="Number of layout columns">
            <span className="column-stepper-label">Columns</span>
            <button
              aria-label="Fewer columns"
              disabled={columnCount <= MIN_COLUMN_COUNT}
              onClick={() => onSetColumnCount(columnCount - 1)}
            >
              −
            </button>
            <span className="column-stepper-value">{columnCount}</span>
            <button
              aria-label="More columns"
              disabled={columnCount >= MAX_COLUMN_COUNT}
              onClick={() => onSetColumnCount(columnCount + 1)}
            >
              +
            </button>
          </div>
        </div>
      )}
      <div className="module-grid">
        {Array.from({ length: columnCount }, (_, col) => (
          <div
            key={col}
            className={["module-column", dragOverColumn === col && "drag-over"]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(event) => {
              if (!draggedModuleId) return;
              event.preventDefault();
              setDragOverColumn(col);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragOverColumn((current) => (current === col ? null : current));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedModuleId) {
                onMoveModule(draggedModuleId, { kind: "column-tail", column: col });
              }
              setDraggedModuleId(null);
              setDragOverModuleId(null);
              setDragOverColumn(null);
            }}
          >
            {workspace.modules
              .map((moduleInstance, index) => ({ moduleInstance, index }))
              .filter(({ moduleInstance, index }) => columnOf(moduleInstance, index) === col)
              .map(({ moduleInstance }) => renderModuleCard(moduleInstance))}
            {!lockLayout && col === columnCount - 1 && renderAddTile()}
          </div>
        ))}
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
