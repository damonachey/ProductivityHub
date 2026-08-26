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
  } = useWorkspaces();

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];

  return (
    <div className="app">
      <TabBar
        workspaces={workspaces}
        activeId={activeWorkspace.id}
        onSelect={setActiveId}
        onAdd={() => {
          const name = window.prompt("Workspace name", `Workspace ${workspaces.length + 1}`);
          if (name) addWorkspace(name);
        }}
        onRemove={removeWorkspace}
        onRename={renameWorkspace}
      />
      <WorkspaceView
        workspace={activeWorkspace}
        onAddModule={(type) => addModule(activeWorkspace.id, type)}
        onRemoveModule={(moduleId) => removeModule(activeWorkspace.id, moduleId)}
      />
    </div>
  );
}
