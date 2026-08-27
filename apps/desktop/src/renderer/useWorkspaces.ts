import { useCallback, useEffect, useState } from "react";
import type { RefreshIntervalsMinutes, Workspace } from "../types";
import { DEFAULT_REFRESH_INTERVALS_MINUTES } from "../types";

function defaultWorkspaces(): Workspace[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Home",
      modules: [{ id: crypto.randomUUID(), type: "github-repos" }],
    },
  ];
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [rememberActiveTab, setRememberActiveTabState] = useState(true);
  const [lockLayout, setLockLayoutState] = useState(false);
  const [refreshIntervalsMinutes, setRefreshIntervalsMinutes] = useState<RefreshIntervalsMinutes>(
    DEFAULT_REFRESH_INTERVALS_MINUTES,
  );

  useEffect(() => {
    Promise.all([window.api.getWorkspaces(), window.api.getSettings()]).then(
      ([state, settings]) => {
        const initial = state.workspaces.length > 0 ? state.workspaces : defaultWorkspaces();
        setWorkspaces(initial);
        setRememberActiveTabState(settings.rememberActiveTab);
        setLockLayoutState(settings.lockLayout);
        setRefreshIntervalsMinutes(settings.refreshIntervalsMinutes);

        if (settings.rememberActiveTab) {
          const restored = initial.some((workspace) => workspace.id === state.activeId);
          setActiveId(restored ? state.activeId : initial[0].id);
        } else {
          setActiveId(initial[0].id);
        }
      },
    );
  }, []);

  useEffect(() => {
    if (workspaces) {
      window.api.saveWorkspaces({ activeId, workspaces });
    }
  }, [workspaces, activeId]);

  const setRememberActiveTab = useCallback(
    (value: boolean) => {
      setRememberActiveTabState(value);
      window.api.saveSettings({ rememberActiveTab: value, lockLayout, refreshIntervalsMinutes });
    },
    [lockLayout, refreshIntervalsMinutes],
  );

  const setLockLayout = useCallback(
    (value: boolean) => {
      setLockLayoutState(value);
      window.api.saveSettings({ rememberActiveTab, lockLayout: value, refreshIntervalsMinutes });
    },
    [rememberActiveTab, refreshIntervalsMinutes],
  );

  useEffect(() => {
    if (workspaces && !workspaces.some((workspace) => workspace.id === activeId)) {
      setActiveId(workspaces[0]?.id ?? "");
    }
  }, [workspaces, activeId]);

  const addWorkspace = useCallback((): Workspace => {
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: `Workspace ${(workspaces?.length ?? 0) + 1}`,
      modules: [],
    };
    setWorkspaces((prev) => [...(prev ?? []), workspace]);
    setActiveId(workspace.id);
    return workspace;
  }, [workspaces]);

  const removeWorkspace = useCallback((id: string) => {
    setWorkspaces((prev) => {
      const next = (prev ?? []).filter((workspace) => workspace.id !== id);
      return next.length > 0 ? next : defaultWorkspaces();
    });
  }, []);

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) => (workspace.id === id ? { ...workspace, name } : workspace)),
    );
  }, []);

  const addModule = useCallback((workspaceId: string, type: string) => {
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, modules: [...workspace.modules, { id: crypto.randomUUID(), type }] }
          : workspace,
      ),
    );
  }, []);

  const removeModule = useCallback((workspaceId: string, moduleId: string) => {
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, modules: workspace.modules.filter((m) => m.id !== moduleId) }
          : workspace,
      ),
    );
  }, []);

  const renameModule = useCallback((workspaceId: string, moduleId: string, title: string) => {
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              modules: workspace.modules.map((m) =>
                m.id === moduleId ? { ...m, title: title || undefined } : m,
              ),
            }
          : workspace,
      ),
    );
  }, []);

  const reorderModules = useCallback(
    (workspaceId: string, draggedId: string, targetId: string) => {
      setWorkspaces((prev) =>
        (prev ?? []).map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          const draggedIndex = workspace.modules.findIndex((m) => m.id === draggedId);
          const targetIndex = workspace.modules.findIndex((m) => m.id === targetId);
          if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
            return workspace;
          }
          const modules = [...workspace.modules];
          const [dragged] = modules.splice(draggedIndex, 1);
          modules.splice(targetIndex, 0, dragged);
          return { ...workspace, modules };
        }),
      );
    },
    [],
  );

  const reorderWorkspaces = useCallback((draggedId: string, targetId: string) => {
    setWorkspaces((prev) => {
      const list = prev ?? [];
      const draggedIndex = list.findIndex((workspace) => workspace.id === draggedId);
      const targetIndex = list.findIndex((workspace) => workspace.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
        return list;
      }
      const next = [...list];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
  }, []);

  return {
    workspaces,
    activeId,
    setActiveId,
    addWorkspace,
    removeWorkspace,
    renameWorkspace,
    addModule,
    removeModule,
    renameModule,
    reorderModules,
    reorderWorkspaces,
    rememberActiveTab,
    setRememberActiveTab,
    lockLayout,
    setLockLayout,
    refreshIntervalsMinutes,
  };
}
