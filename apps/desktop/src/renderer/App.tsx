import { useEffect } from "react";
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
    reorderModules,
    reorderWorkspaces,
    rememberActiveTab,
    setRememberActiveTab,
    lockLayout,
    setLockLayout,
  } = useWorkspaces();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!event.ctrlKey || !workspaces || workspaces.length === 0) return;

      if (event.key === "Tab") {
        event.preventDefault();
        const currentIndex = workspaces.findIndex((workspace) => workspace.id === activeId);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + workspaces.length) % workspaces.length;
        setActiveId(workspaces[nextIndex].id);
        return;
      }

      const tabNumber = Number(event.key);
      if (tabNumber >= 1 && tabNumber <= 9) {
        const workspace = workspaces[tabNumber - 1];
        if (workspace) {
          event.preventDefault();
          setActiveId(workspace.id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspaces, activeId, setActiveId]);

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
        rememberActiveTab={rememberActiveTab}
        onSetRememberActiveTab={setRememberActiveTab}
        lockLayout={lockLayout}
        onSetLockLayout={setLockLayout}
      />
      <WorkspaceView
        workspace={activeWorkspace}
        onAddModule={(type) => addModule(activeWorkspace.id, type)}
        onRemoveModule={(moduleId) => removeModule(activeWorkspace.id, moduleId)}
        onReorderModule={(draggedId, targetId) =>
          reorderModules(activeWorkspace.id, draggedId, targetId)
        }
        lockLayout={lockLayout}
      />
    </div>
  );
}
