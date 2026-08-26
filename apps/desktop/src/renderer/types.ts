export interface ModuleInstance {
  id: string;
  type: string;
}

export interface Workspace {
  id: string;
  name: string;
  modules: ModuleInstance[];
}
