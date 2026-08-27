import { useEffect, useRef, useState } from "react";
import type { Workspace } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { buildSearchIndex, filterSearchIndex, type SearchItem, type SearchResult } from "./search";

interface Props {
  workspaces: Workspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => Workspace;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  rememberActiveTab: boolean;
  onSetRememberActiveTab: (value: boolean) => void;
  lockLayout: boolean;
  onSetLockLayout: (value: boolean) => void;
}

export function TabBar({
  workspaces,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onReorder,
  rememberActiveTab,
  onSetRememberActiveTab,
  lockLayout,
  onSetLockLayout,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<Workspace | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState<SearchItem[] | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  function refreshSearchIndex(): void {
    // Rebuilt fresh on every focus - cheap (local IPC + in-memory cache
    // reads only), and keeps results from going stale between searches.
    buildSearchIndex(workspaces).then(setSearchIndex);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key === ",") {
        event.preventDefault();
        setSettingsOpen((open) => !open);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "Escape") {
        setSettingsOpen(false);
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchResults: SearchResult[] = searchIndex ? filterSearchIndex(searchIndex, searchQuery) : [];

  useEffect(() => {
    setActiveResultIndex(0);
  }, [searchQuery, searchResults.length]);

  function goToResult(result: SearchResult): void {
    onSelect(result.workspaceId);
    setSearchQuery("");
    searchInputRef.current?.blur();
  }

  function startEditing(workspace: Workspace): void {
    if (lockLayout) return;
    setEditingId(workspace.id);
    setDraftName(workspace.name);
  }

  function commitEditing(): void {
    if (editingId && draftName.trim()) {
      onRename(editingId, draftName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="tab-bar">
      {workspaces.map((workspace) => (
        <div
          key={workspace.id}
          className={[
            "tab",
            workspace.id === activeId && "active",
            workspace.id === draggedId && "dragging",
            workspace.id === dragOverId && "drag-over",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onSelect(workspace.id)}
          draggable={editingId !== workspace.id}
          onDragStart={() => setDraggedId(workspace.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggedId && draggedId !== workspace.id) {
              setDragOverId(workspace.id);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedId && draggedId !== workspace.id) {
              onReorder(draggedId, workspace.id);
            }
            setDraggedId(null);
            setDragOverId(null);
          }}
        >
          {editingId === workspace.id ? (
            <input
              className="tab-rename-input"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onFocus={(event) => event.target.select()}
              onBlur={commitEditing}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitEditing();
                if (event.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <span
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEditing(workspace);
              }}
            >
              {workspace.name}
            </span>
          )}
          {!lockLayout && workspaces.length > 1 && (
            <button
              className="tab-close"
              aria-label={`Close ${workspace.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setRemoveCandidate(workspace);
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!lockLayout && (
        <button
          className="tab-add"
          aria-label="Add workspace"
          onClick={() => startEditing(onAdd())}
        >
          +
        </button>
      )}

      <div className="tab-bar-actions">
        <div className="tab-search-wrapper">
          <input
            ref={searchInputRef}
            className="tab-search-input"
            placeholder="CTRL-F to Search…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              refreshSearchIndex();
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchQuery("");
                searchInputRef.current?.blur();
              }
              if (event.key === "ArrowDown" && searchResults.length > 0) {
                event.preventDefault();
                setActiveResultIndex((index) => (index + 1) % searchResults.length);
              }
              if (event.key === "ArrowUp" && searchResults.length > 0) {
                event.preventDefault();
                setActiveResultIndex((index) => (index - 1 + searchResults.length) % searchResults.length);
              }
              if (event.key === "Enter" && searchResults[activeResultIndex]) {
                goToResult(searchResults[activeResultIndex]);
              }
            }}
          />
          {searchFocused && searchQuery.trim() && (
            <div className="search-results">
              {!searchIndex ? (
                <p className="search-empty">Loading…</p>
              ) : searchResults.length === 0 ? (
                <p className="search-empty">No matches.</p>
              ) : (
                searchResults.map((result, index) => (
                  <button
                    key={result.key}
                    className={`search-result${index === activeResultIndex ? " active" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveResultIndex(index)}
                    onClick={() => goToResult(result)}
                  >
                    <span className="search-result-category">{result.category}</span>
                    <span className="search-result-snippet">{result.snippet}</span>
                    <span className="search-result-meta">
                      {result.workspaceName}
                      {result.moduleId ? ` · ${result.moduleTitle}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="tab-settings-wrapper">
          <button
            className="tab-settings-button"
            aria-label="Quick Settings"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            ⚙
          </button>
          {settingsOpen && (
            <>
              <div className="popup-backdrop" onClick={() => setSettingsOpen(false)} />
              <div className="settings-popup">
                <div className="settings-popup-title">Quick Settings</div>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={lockLayout}
                    onChange={(event) => onSetLockLayout(event.target.checked)}
                  />
                  Lock layout
                </label>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberActiveTab}
                    onChange={(event) => onSetRememberActiveTab(event.target.checked)}
                  />
                  Remember active tab
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {removeCandidate && (
        <ConfirmDialog
          message={`Close the "${removeCandidate.name}" tab and all its modules?`}
          confirmLabel="Remove"
          onConfirm={() => {
            onRemove(removeCandidate.id);
            setRemoveCandidate(null);
          }}
          onCancel={() => setRemoveCandidate(null)}
        />
      )}
    </div>
  );
}
