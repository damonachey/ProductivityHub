import type { RefreshIntervalsMinutes } from "../../types";

export interface ModuleProps {
  moduleId: string;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
  // Lets a module override its card header title link with something
  // instance-specific (e.g. Weather linking to the configured location's
  // own forecast page) instead of the static per-type link in WorkspaceView.
  onTitleUrlChange?: (url: string | null) => void;
}
