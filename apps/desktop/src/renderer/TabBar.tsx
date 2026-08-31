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
  showLinkUrl: boolean;
  onSetShowLinkUrl: (value: boolean) => void;
  hideMenuBar: boolean;
  onSetHideMenuBar: (value: boolean) => void;
  onHighlightModule: (moduleId: string, itemId: string | null) => void;
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
  showLinkUrl,
  onSetShowLinkUrl,
  hideMenuBar,
  onSetHideMenuBar,
  onHighlightModule,
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
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Surfaces the Ctrl+1-9 tab-jump shortcut (see App.tsx) as a badge on each
  // tab while Ctrl is held. Also clears on window blur - alt-tabbing away
  // while holding Ctrl means the keyup never reaches this listener, which
  // would otherwise leave the badges stuck showing.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Control") setCtrlHeld(true);
    }
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === "Control") setCtrlHeld(false);
    }
    function handleBlur(): void {
      setCtrlHeld(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

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

      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onSetLockLayout(!lockLayout);
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
  }, [lockLayout, onSetLockLayout]);

  const searchResults: SearchResult[] = searchIndex ? filterSearchIndex(searchIndex, searchQuery) : [];

  useEffect(() => {
    setActiveResultIndex(0);
  }, [searchQuery, searchResults.length]);

  function goToResult(result: SearchResult): void {
    onSelect(result.workspaceId);
    if (result.moduleId) onHighlightModule(result.moduleId, result.itemId);
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
      {workspaces.map((workspace, index) => (
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
          {ctrlHeld && index < 9 && (
            <span className="tab-shortcut-badge" title={`Ctrl+${index + 1}`}>
              {index + 1}
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
            aria-label="Settings"
            title="Settings (Ctrl+,)"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            ⚙
          </button>
          {settingsOpen && (
            <>
              <div className="popup-backdrop" onClick={() => setSettingsOpen(false)} />
              <div className="settings-popup">
                <div className="settings-popup-title">Settings</div>
                <label className="settings-checkbox" title="Ctrl+L">
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
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={showLinkUrl}
                    onChange={(event) => onSetShowLinkUrl(event.target.checked)}
                  />
                  Show link URL
                </label>
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={hideMenuBar}
                    onChange={(event) => onSetHideMenuBar(event.target.checked)}
                  />
                  Hide menu bar
                </label>
                <p className="settings-popup-hint">
                  Ctrl+1-9 jumps to a tab, Ctrl+Tab / Ctrl+Shift+Tab cycles tabs, Ctrl+L toggles the
                  layout lock.
                </p>
                <button
                  className="settings-popup-action"
                  onClick={async () => {
                    const result = await window.api.exportConfig();
                    if (!result.ok && result.error) window.alert(result.error);
                  }}
                >
                  Export settings…
                </button>
                <button
                  className="settings-popup-action"
                  onClick={async () => {
                    const result = await window.api.importConfig();
                    if (!result.ok && result.error) window.alert(result.error);
                  }}
                >
                  Import settings…
                </button>
                <div className="settings-popup-divider" />
                <button
                  className="settings-popup-action"
                  onClick={() => window.api.showAbout()}
                >
                  About ProductivityHub…
                </button>
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
