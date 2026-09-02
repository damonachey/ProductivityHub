import { useCallback, useEffect, useState } from "react";
import type { ModuleDropTarget, ModuleInstance, RefreshIntervalsMinutes, Workspace } from "../types";
import {
  DEFAULT_COLUMN_COUNT,
  DEFAULT_REFRESH_INTERVALS_MINUTES,
  MAX_COLUMN_COUNT,
  MIN_COLUMN_COUNT,
} from "../types";

// Resolves the column every module sits in, filling the fallback
// (`arrayIndex % columnCount`) for any module without an explicit `column`
// and clamping stored values into range. Returned in the same order as
// `modules`, which is also the top-to-bottom order within each column.
function resolveColumns(modules: ModuleInstance[], columnCount: number): number[] {
  return modules.map((module, index) => {
    const raw = module.column ?? index % columnCount;
    return Math.max(0, Math.min(columnCount - 1, raw));
  });
}

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
  const [showLinkUrl, setShowLinkUrlState] = useState(false);
  const [hideMenuBar, setHideMenuBarState] = useState(false);
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
        setShowLinkUrlState(settings.showLinkUrl);
        setHideMenuBarState(settings.hideMenuBar);
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
      window.api.saveSettings({
        rememberActiveTab: value,
        lockLayout,
        showLinkUrl,
        hideMenuBar,
        refreshIntervalsMinutes,
      });
    },
    [lockLayout, showLinkUrl, hideMenuBar, refreshIntervalsMinutes],
  );

  const setLockLayout = useCallback(
    (value: boolean) => {
      setLockLayoutState(value);
      window.api.saveSettings({
        rememberActiveTab,
        lockLayout: value,
        showLinkUrl,
        hideMenuBar,
        refreshIntervalsMinutes,
      });
    },
    [rememberActiveTab, showLinkUrl, hideMenuBar, refreshIntervalsMinutes],
  );

  const setShowLinkUrl = useCallback(
    (value: boolean) => {
      setShowLinkUrlState(value);
      window.api.saveSettings({
        rememberActiveTab,
        lockLayout,
        showLinkUrl: value,
        hideMenuBar,
        refreshIntervalsMinutes,
      });
    },
    [rememberActiveTab, lockLayout, hideMenuBar, refreshIntervalsMinutes],
  );

  const setHideMenuBar = useCallback(
    (value: boolean) => {
      setHideMenuBarState(value);
      window.api.saveSettings({
        rememberActiveTab,
        lockLayout,
        showLinkUrl,
        hideMenuBar: value,
        refreshIntervalsMinutes,
      });
    },
    [rememberActiveTab, lockLayout, showLinkUrl, refreshIntervalsMinutes],
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

  const resizeModule = useCallback(
    (workspaceId: string, moduleId: string, height: number | undefined) => {
      setWorkspaces((prev) =>
        (prev ?? []).map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                modules: workspace.modules.map((m) =>
                  m.id === moduleId ? { ...m, height: height || undefined } : m,
                ),
              }
            : workspace,
        ),
      );
    },
    [],
  );

  const setWorkspaceColumnCount = useCallback((workspaceId: string, columnCount: number) => {
    const clamped = Math.max(MIN_COLUMN_COUNT, Math.min(MAX_COLUMN_COUNT, columnCount));
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, columnCount: clamped } : workspace,
      ),
    );
  }, []);

  const setWorkspaceColumnWidths = useCallback((workspaceId: string, columnWidths: number[]) => {
    // Normalise so the weights average 1 (keeps stored numbers readable and
    // independent of the pixel widths they were derived from).
    const positive = columnWidths.map((w) => (w > 0 && Number.isFinite(w) ? w : 1));
    const mean = positive.reduce((sum, w) => sum + w, 0) / (positive.length || 1);
    const normalised = mean > 0 ? positive.map((w) => w / mean) : positive;
    setWorkspaces((prev) =>
      (prev ?? []).map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, columnWidths: normalised } : workspace,
      ),
    );
  }, []);

  // Moves a module within or between columns. The workspace's `modules`
  // array is both the drop order and the top-to-bottom order inside each
  // column, so every move first freezes all modules to explicit columns
  // (via resolveColumns), then re-inserts the dragged one relative to its
  // drop target.
  const moveModule = useCallback(
    (workspaceId: string, draggedId: string, target: ModuleDropTarget) => {
      setWorkspaces((prev) =>
        (prev ?? []).map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;

          const columnCount = Math.max(
            MIN_COLUMN_COUNT,
            Math.min(MAX_COLUMN_COUNT, workspace.columnCount ?? DEFAULT_COLUMN_COUNT),
          );
          const columns = resolveColumns(workspace.modules, columnCount);
          const withColumns = workspace.modules.map((module, index) => ({
            ...module,
            column: columns[index],
          }));

          const draggedIndex = withColumns.findIndex((m) => m.id === draggedId);
          if (draggedIndex === -1) return workspace;

          const targetColumn =
            target.kind === "before-module"
              ? (withColumns.find((m) => m.id === target.moduleId)?.column ?? 0)
              : Math.max(0, Math.min(columnCount - 1, target.column));

          const [dragged] = withColumns.splice(draggedIndex, 1);
          dragged.column = targetColumn;

          if (target.kind === "before-module") {
            const targetIndex = withColumns.findIndex((m) => m.id === target.moduleId);
            if (targetIndex === -1) return workspace;
            withColumns.splice(targetIndex, 0, dragged);
          } else {
            // Append after the last module already in that column, keeping
            // the array grouped column-by-column for readability.
            let insertAt = withColumns.length;
            for (let i = withColumns.length - 1; i >= 0; i--) {
              if (withColumns[i].column === targetColumn) {
                insertAt = i + 1;
                break;
              }
            }
            withColumns.splice(insertAt, 0, dragged);
          }

          return { ...workspace, modules: withColumns };
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
    resizeModule,
    moveModule,
    setWorkspaceColumnCount,
    setWorkspaceColumnWidths,
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
  };
}
