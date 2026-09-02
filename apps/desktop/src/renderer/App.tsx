import { useEffect, useState } from "react";
import { TabBar } from "./TabBar";
import { WorkspaceView } from "./WorkspaceView";
import { LinkStatusBar } from "./LinkStatusBar";
import { useWorkspaces } from "./useWorkspaces";
import { flushAllPending } from "./pendingActions";

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
    renameModule,
    resizeModule,
    moveModule,
    setWorkspaceColumnCount,
    reorderWorkspaces,
    rememberActiveTab,
    setRememberActiveTab,
    lockLayout,
    setLockLayout,
    showLinkUrl,
    setShowLinkUrl,
    hideMenuBar,
    setHideMenuBar,
    refreshIntervalsMinutes,
  } = useWorkspaces();
  // `token` increments on every highlight request so re-selecting the same
  // search result restarts the flash animation instead of no-op'ing (React
  // won't replay a CSS animation from an unchanged key alone).
  const [highlightedModule, setHighlightedModule] = useState<{
    moduleId: string;
    itemId: string | null;
    token: number;
  } | null>(null);

  function highlightModule(moduleId: string, itemId: string | null): void {
    setHighlightedModule((prev) => ({ moduleId, itemId, token: (prev?.token ?? 0) + 1 }));
  }

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

  useEffect(() => {
    return window.api.onFlushBeforeQuit(() => {
      flushAllPending().finally(() => window.api.notifyFlushComplete());
    });
  }, []);

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
        showLinkUrl={showLinkUrl}
        onSetShowLinkUrl={setShowLinkUrl}
        hideMenuBar={hideMenuBar}
        onSetHideMenuBar={setHideMenuBar}
        onHighlightModule={highlightModule}
      />
      <WorkspaceView
        workspace={activeWorkspace}
        onAddModule={(type) => addModule(activeWorkspace.id, type)}
        onRemoveModule={(moduleId) => removeModule(activeWorkspace.id, moduleId)}
        onRenameModule={(moduleId, title) => renameModule(activeWorkspace.id, moduleId, title)}
        onResizeModule={(moduleId, height) => resizeModule(activeWorkspace.id, moduleId, height)}
        onMoveModule={(draggedId, target) => moveModule(activeWorkspace.id, draggedId, target)}
        onSetColumnCount={(count) => setWorkspaceColumnCount(activeWorkspace.id, count)}
        lockLayout={lockLayout}
        refreshIntervalsMinutes={refreshIntervalsMinutes}
        highlightedModule={highlightedModule}
      />
      <LinkStatusBar enabled={showLinkUrl} />
    </div>
  );
}
