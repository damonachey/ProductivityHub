import type { RefreshIntervalsMinutes } from "../../types";

export interface ModuleProps {
  moduleId: string;
  lockLayout: boolean;
  refreshIntervalsMinutes: RefreshIntervalsMinutes;
}
