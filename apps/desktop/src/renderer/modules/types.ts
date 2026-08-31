import type { RefreshIntervalsMinutes } from "../../types";

export interface ModuleProps {
  moduleId: string;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
  // Lets a module override its card header title link with something
  // instance-specific (e.g. Weather linking to the configured location's
  // own forecast page) instead of the static per-type link in WorkspaceView.
  onTitleUrlChange?: (url: string | null) => void;
  // Lets a module override its card header title text with something
  // instance-specific (e.g. GitHub Issues appending its configured repo).
  // A user's own manual rename still takes precedence over this.
  onTitleTextChange?: (title: string | null) => void;
}
