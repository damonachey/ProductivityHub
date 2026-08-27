import path from "node:path";
import os from "node:os";

// Single per-user config directory shared by the CLI and desktop app,
// independent of the repo/install location (so it still works for a
// distributed portable exe, which has no "repo" to resolve paths against).
export const CONFIG_DIR = path.join(os.homedir(), ".productivityhub");
