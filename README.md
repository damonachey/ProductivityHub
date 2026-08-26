# ProductivityHub

Electron desktop app and `ph` CLI for productivity tools, starting with Gmail, Google Tasks, Google Calendar, and GitHub — with more integrations planned.

## Usage

```
GITHUB_TOKEN=<a personal access token> ph gh repos
```

Lists your GitHub repos, most recently updated first. This is the first working integration; the others are still scaffolding.

## Layout

```
apps/
  desktop/            Electron app
  cli/                `ph` CLI (subcommands per service, e.g. `ph mail list`, `ph cal today`)
packages/
  core/               Shared auth/config/logging used by all apps and services
  services/
    google-mail/      Gmail API wrapper
    google-tasks/      Google Tasks API wrapper
    google-calendar/   Google Calendar API wrapper
    github/            GitHub API wrapper
```

`apps/` holds runnable programs; `packages/` holds shared logic with no entry point of its own. Both apps consume the same `packages/services/*` packages so integration logic is written once.

This is being built incrementally — the service packages are still empty scaffolds, with real integrations landing in later commits.

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
