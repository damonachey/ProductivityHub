export interface ModuleInstance {
  id: string;
  type: string;
}

export interface Workspace {
  id: string;
  name: string;
  modules: ModuleInstance[];
}

export interface WorkspaceState {
  activeId: string;
  workspaces: Workspace[];
}

export interface AppSettings {
  rememberActiveTab: boolean;
  lockLayout: boolean;
}

// Keyed by module instance id, so each Notes module instance keeps its own
// independent text.
export type NotesState = Record<string, string>;
