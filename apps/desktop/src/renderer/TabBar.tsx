import { useEffect, useState } from "react";
import type { Workspace } from "../types";

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key === ",") {
        event.preventDefault();
        setSettingsOpen((open) => !open);
        return;
      }

      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
                onRemove(workspace.id);
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
  );
}
