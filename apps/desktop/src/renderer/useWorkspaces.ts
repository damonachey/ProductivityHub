import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "../types";

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

  useEffect(() => {
    window.api.getWorkspaces().then((loaded) => {
      const initial = loaded.length > 0 ? loaded : defaultWorkspaces();
      setWorkspaces(initial);
      setActiveId(initial[0].id);
    });
  }, []);

  useEffect(() => {
    if (workspaces) {
      window.api.saveWorkspaces(workspaces);
    }
  }, [workspaces]);

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
    reorderWorkspaces,
  };
}
