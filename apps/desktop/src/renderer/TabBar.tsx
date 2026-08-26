import type { Workspace } from "./types";

interface Props {
  workspaces: Workspace[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function TabBar({ workspaces, activeId, onSelect, onAdd, onRemove, onRename }: Props) {
  return (
    <div className="tab-bar">
      {workspaces.map((workspace) => (
        <div
          key={workspace.id}
          className={`tab${workspace.id === activeId ? " active" : ""}`}
          onClick={() => onSelect(workspace.id)}
        >
          <span
            onDoubleClick={(event) => {
              event.stopPropagation();
              const name = window.prompt("Rename workspace", workspace.name);
              if (name) onRename(workspace.id, name);
            }}
          >
            {workspace.name}
          </span>
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
      <button className="tab-add" aria-label="Add workspace" onClick={onAdd}>
        +
      </button>
    </div>
  );
}
