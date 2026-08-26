import { useState } from "react";
import type { Workspace } from "./types";

interface Props {
  workspaces: Workspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => Workspace;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function TabBar({ workspaces, activeId, onSelect, onAdd, onRemove, onRename }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function startEditing(workspace: Workspace): void {
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
          className={`tab${workspace.id === activeId ? " active" : ""}`}
          onClick={() => onSelect(workspace.id)}
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
          {workspaces.length > 1 && (
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
      <button
        className="tab-add"
        aria-label="Add workspace"
        onClick={() => startEditing(onAdd())}
      >
        +
      </button>
    </div>
  );
}
