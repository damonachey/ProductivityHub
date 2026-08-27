# ProductivityHub

Electron desktop app and `ph` CLI for productivity tools: GitHub, Gmail, Google Tasks, Google Calendar (list and month-grid views), Weather, FreshRSS, Slashdot, Hacker News, and stock quotes/charts, plus simple utility modules (Bookmarks, Notes, embedded Web Page). All are wired to real data in the desktop app.

## Usage

All config lives in one place, outside the repo: `~/.productivityhub/` (works the same whether you're running from source or a distributed portable exe, which has no "repo" on disk). Create `~/.productivityhub/config.json` with whichever of these your modules need:

```json
{
  "GITHUB_TOKEN": "<a personal access token>",
  "GOOGLE_CLIENT_ID": "<OAuth client id>",
  "GOOGLE_CLIENT_SECRET": "<OAuth client secret>",
  "FRESHRSS_URL": "<your FreshRSS instance URL>",
  "FRESHRSS_USER": "<FreshRSS username>",
  "FRESHRSS_API_PASSWORD": "<FreshRSS API password>"
}
```

- `GITHUB_TOKEN` — GitHub Repos / Notifications modules.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — a single Google Cloud OAuth client shared by Gmail, Google Tasks, and Google Calendar. Each still goes through its own consent screen and keeps its own token file, since they're separate scopes/grants.
- `FRESHRSS_URL` / `FRESHRSS_USER` / `FRESHRSS_API_PASSWORD` — FreshRSS module (needs FreshRSS's API password, not your regular login password).
- Stock Quotes/Chart (Yahoo Finance), Weather (Open-Meteo), Slashdot, and Hacker News need no config at all — no account, no API key.

`packages/core`'s `requireEnv()` reads from this file (an actual environment variable of the same name still takes precedence, e.g. `GITHUB_TOKEN=... ph gh repos`, useful for CI or one-off overrides).

```
ph gh repos
```

Lists your GitHub repos, most recently updated first. This is the only CLI command implemented so far — everything else so far is desktop-app-only.

The desktop app (`.\phdesktop.cmd`, or `pnpm --filter @productivityhub/desktop build && pnpm --filter @productivityhub/desktop start`) is a dashboard: tabs across the top are workspaces (add/rename/close), and each workspace holds a grid of modules you add from a picker. A module's card title can be renamed per-instance (useful when you have several of the same module, e.g. Weather for different cities).

### Where things are stored

| What | Where |
| --- | --- |
| Secrets (`GITHUB_TOKEN`, etc.) | `~/.productivityhub/config.json` |
| Desktop workspace/module layout | `~/.productivityhub/workspaces.json` |
| Desktop window size/position | `%APPDATA%\@productivityhub\desktop\window-state.json` (Electron-chrome-specific, kept separate) |

The first two are shared by both the CLI and the desktop app and owned by `packages/core` / the desktop main process respectively; window state is Electron-only so it stays in Electron's own per-app userData dir.

## Layout

```
apps/
  desktop/            Electron app
  cli/                `ph` CLI (subcommands per service, e.g. `ph mail list`, `ph cal today`)
packages/
  core/               Shared auth/config/logging used by all apps and services
  services/
    github/           GitHub API wrapper
    google-mail/      Gmail API wrapper
    google-tasks/     Google Tasks API wrapper
    google-calendar/  Google Calendar API wrapper (list view and month-grid view)
    open-meteo/       Weather forecast + geocoding (Open-Meteo, free/keyless)
    yahoo-finance/    Stock quotes/candles
    freshrss/         FreshRSS unread items
    slashdot/         Slashdot headlines
    hackernews/       Hacker News top stories
```

`apps/` holds runnable programs; `packages/` holds shared logic with no entry point of its own. The desktop app consumes all of the `packages/services/*` packages above; the CLI so far only consumes `github` (see Usage).

## Building portable executables

### CLI (`ph`)

```
pnpm --filter @productivityhub/cli package
```

Bundles the CLI with esbuild and embeds it in a Node binary (Node's Single Executable Application feature) for each platform. Output goes to `apps/cli/release/`:

| OS | File |
| --- | --- |
| Windows (x64) | `apps/cli/release/ph-win-x64.exe` |
| macOS (Intel) | `apps/cli/release/ph-macos-x64` |
| macOS (Apple Silicon) | `apps/cli/release/ph-macos-arm64` |
| Linux (x64) | `apps/cli/release/ph-linux-x64` |

Each file is fully standalone — no separate Node install required to run it.

### Desktop app

```
pnpm --filter @productivityhub/desktop build
pnpm --filter @productivityhub/desktop package
```

Uses `electron-builder`. Output goes to `apps/desktop/release/`, named `ProductivityHub-<version>-<os>-<arch>.<ext>`:

| OS | File (for version 0.0.0) |
| --- | --- |
| Windows (x64, portable) | `apps/desktop/release/ProductivityHub-0.0.0-win-x64.exe` |
| macOS (x64, zip) | `apps/desktop/release/ProductivityHub-0.0.0-mac-x64.zip` |
| macOS (arm64, zip) | `apps/desktop/release/ProductivityHub-0.0.0-mac-arm64.zip` |
| Linux (x64, AppImage) | `apps/desktop/release/ProductivityHub-0.0.0-linux-x64.AppImage` |

The Windows portable exe is built and verified to run standalone on this repo's dev machine. The mac and Linux targets are configured but must actually be built on/for those OSes (e.g. via a CI matrix build) — they can't be produced or tested from Windows.

`apps/*/release/` (and `build/`) are gitignored build output, not checked in.
