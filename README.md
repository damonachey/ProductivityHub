# ProductivityHub

Electron desktop app and `ph` CLI for productivity tools: GitHub, Gmail, Google Tasks, Google Calendar (list and month-grid views), Weather, FreshRSS, RSS/Atom (arbitrary feed URLs), Slashdot, Hacker News, and stock quotes/charts, plus simple utility modules (Bookmarks, Notes, embedded Web Page). All are wired to real data in the desktop app.

## Usage

All config lives in one place, outside the repo: `~/.productivityhub/` (works the same whether you're running from source or a distributed portable exe, which has no "repo" on disk). Create `~/.productivityhub/secrets.json` with whichever of these your modules need:

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

`packages/core`'s `requireEnv()` reads from this file (an actual environment variable of the same name still takes precedence, e.g. `GITHUB_TOKEN=... ph gh repos`, useful for CI or one-off overrides). OAuth tokens for Gmail, Google Tasks, and Google Calendar are also stored in `secrets.json`, written automatically the first time you connect each one from the desktop app.

```
ph gh repos
```

Lists your GitHub repos, most recently updated first. This is the only CLI command implemented so far — everything else so far is desktop-app-only.

The desktop app (`.\phdesktop.cmd` — see [Building from source](#building-from-source) if it's not built yet) is a dashboard: tabs across the top are workspaces (add/rename/close), and each workspace holds a grid of modules you add from a picker. A module's card title can be renamed per-instance (useful when you have several of the same module, e.g. Weather for different cities).

Settings (the ⚙ icon, top right, or Ctrl+,) also has **Export configuration…** / **Import configuration…** — export writes your entire workspace layout and every module's data (notes, bookmarks, RSS feeds, etc.) to a single JSON file; import reads one back in and reloads the app. Secrets and OAuth tokens are never included, so after importing on a new machine you'll need to re-create `secrets.json` and reconnect Gmail/Tasks/Calendar.

### Where things are stored

| What | Where |
| --- | --- |
| Secrets (`GITHUB_TOKEN`, OAuth tokens, etc.) | `~/.productivityhub/secrets.json` |
| Everything else (workspace/module layout, app settings, per-module data) | `~/.productivityhub/settings.json` |
| Desktop window size/position | `%APPDATA%\@productivityhub\desktop\window-state.json` (Electron-chrome-specific, kept separate) |

The first two are shared by both the CLI and the desktop app and owned by `packages/core` / the desktop main process respectively; window state is Electron-only so it stays in Electron's own per-app userData dir. This is a breaking change from the older per-file layout (`config.json`, `workspaces.json`, and a dozen other per-module files) — there's no automatic migration, so an existing install needs to move to the new files by hand (or just reconfigure from scratch).

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
    rss/              Generic RSS/Atom feed fetching + parsing (arbitrary feed URLs)
    slashdot/         Slashdot headlines
    hackernews/       Hacker News top stories
```

`apps/` holds runnable programs; `packages/` holds shared logic with no entry point of its own. The desktop app consumes all of the `packages/services/*` packages above; the CLI so far only consumes `github` (see Usage).

## Building from source

Prerequisites: Node.js >= 20, and pnpm 11.24.0 (the repo pins this via `packageManager`; `corepack enable` picks it up automatically, or install directly with `npm install -g pnpm@11.24.0`).

```
pnpm install
pnpm -r run build
```

`pnpm install` installs dependencies for every workspace package (`apps/*`, `packages/core`, `packages/services/*`). `pnpm -r run build` then builds all of them in dependency order — `packages/core`, then `packages/services/*` (which depend on it), then `apps/cli` and `apps/desktop` (which depend on those) — each via its own `tsc`, with the desktop app additionally running `vite build` for its renderer bundle. Every package's build output goes to its own `dist/`, which is what the other workspace packages, `ph.cmd`, and `phdesktop.cmd` actually run against — not the TypeScript source directly.

To rebuild just one package after a change (faster than a full `-r build`, but only safe once everything has been built at least once): `pnpm --filter <package-name> build`, e.g. `pnpm --filter @productivityhub/desktop build` or `pnpm --filter @productivityhub/github build`. If you've changed a `packages/*` dependency, rebuild it too (or just re-run `pnpm -r run build`) — a filtered build only rebuilds that one package, not its dependencies.

To typecheck everything without emitting: `pnpm -r run typecheck`.

Once built, run it with:

| What | Windows | Cross-platform |
| --- | --- | --- |
| Desktop app | `.\phdesktop.cmd` | `pnpm --filter @productivityhub/desktop start` |
| CLI | `.\ph.cmd <command>` | `node apps/cli/dist/index.js <command>` |

Both wrapper scripts run the built `dist/` output directly (no dev server), so after any source change you need to rebuild (see above) before relaunching for the change to take effect.

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

| OS | File (for version 0.2.0) |
| --- | --- |
| Windows (x64, portable) | `apps/desktop/release/ProductivityHub-0.2.0-win-x64.exe` |
| macOS (x64, zip) | `apps/desktop/release/ProductivityHub-0.2.0-mac-x64.zip` |
| macOS (arm64, zip) | `apps/desktop/release/ProductivityHub-0.2.0-mac-arm64.zip` |
| Linux (x64, AppImage) | `apps/desktop/release/ProductivityHub-0.2.0-linux-x64.AppImage` |

The Windows portable exe is built and verified to run standalone on this repo's dev machine. The mac and Linux targets are configured but must actually be built on/for those OSes (e.g. via a CI matrix build) — they can't be produced or tested from Windows.

`apps/*/release/` (and `build/`) are gitignored build output, not checked in.
