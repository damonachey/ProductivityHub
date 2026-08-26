import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "./types";

const STORAGE_KEY = "productivityhub.workspaces";

function defaultWorkspaces(): Workspace[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Home",
      modules: [{ id: crypto.randomUUID(), type: "github-repos" }],
    },
  ];
}

function loadWorkspaces(): Workspace[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultWorkspaces();

  try {
    const parsed = JSON.parse(raw) as Workspace[];
    return parsed.length > 0 ? parsed : defaultWorkspaces();
  } catch {
    return defaultWorkspaces();
  }
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
  const [activeId, setActiveId] = useState<string>(() => loadWorkspaces()[0].id);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    if (!workspaces.some((workspace) => workspace.id === activeId)) {
      setActiveId(workspaces[0]?.id ?? "");
    }
  }, [workspaces, activeId]);

  const addWorkspace = useCallback((): Workspace => {
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: `Workspace ${workspaces.length + 1}`,
      modules: [],
    };
    setWorkspaces((prev) => [...prev, workspace]);
    setActiveId(workspace.id);
    return workspace;
  }, [workspaces.length]);

  const removeWorkspace = useCallback((id: string) => {
    setWorkspaces((prev) => {
      const next = prev.filter((workspace) => workspace.id !== id);
      return next.length > 0 ? next : defaultWorkspaces();
    });
  }, []);

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((prev) =>
      prev.map((workspace) => (workspace.id === id ? { ...workspace, name } : workspace)),
    );
  }, []);

  const addModule = useCallback((workspaceId: string, type: string) => {
    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, modules: [...workspace.modules, { id: crypto.randomUUID(), type }] }
          : workspace,
      ),
    );
  }, []);

  const removeModule = useCallback((workspaceId: string, moduleId: string) => {
    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === workspaceId
          ? { ...workspace, modules: workspace.modules.filter((m) => m.id !== moduleId) }
          : workspace,
      ),
    );
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
  };
}
