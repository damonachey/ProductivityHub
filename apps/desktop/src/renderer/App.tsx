import { TabBar } from "./TabBar";
import { WorkspaceView } from "./WorkspaceView";
import { useWorkspaces } from "./useWorkspaces";

export function App() {
  const {
    workspaces,
    activeId,
    setActiveId,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    addModule,
    removeModule,
    reorderWorkspaces,
  } = useWorkspaces();

  if (!workspaces) {
    return <div className="app-loading">Loading…</div>;
  }

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];

  return (
    <div className="app">
      <TabBar
        workspaces={workspaces}
        activeId={activeWorkspace.id}
        onSelect={setActiveId}
        onAdd={addWorkspace}
        onRemove={removeWorkspace}
        onRename={renameWorkspace}
        onReorder={reorderWorkspaces}
      />
      <WorkspaceView
        workspace={activeWorkspace}
        onAddModule={(type) => addModule(activeWorkspace.id, type)}
        onRemoveModule={(moduleId) => removeModule(activeWorkspace.id, moduleId)}
      />
    </div>
  );
}
