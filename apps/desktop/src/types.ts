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

export interface BookmarkItem {
  id: string;
  url: string;
  title?: string;
}

// Keyed by module instance id, so each Bookmarks module instance keeps its
// own independent, ordered list.
export type BookmarksState = Record<string, BookmarkItem[]>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Keyed by module instance id: the last-navigated URL, so a Web Page module
// resumes where it left off across app restarts.
export type WebPagesState = Record<string, string>;
