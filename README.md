# ProductivityHub

Electron desktop app and `ph` CLI for productivity tools, starting with Gmail, Google Tasks, Google Calendar, and GitHub — with more integrations planned.

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

This is being built incrementally — folders above are scaffolding for now, with implementations landing in later commits.
