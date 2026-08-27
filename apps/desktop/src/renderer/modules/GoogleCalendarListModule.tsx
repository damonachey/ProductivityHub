import { useEffect, useState } from "react";
import type { CalendarEvent } from "@productivityhub/google-calendar";
import { setCached } from "../cache";
import { googleCalendarListCacheKey } from "../search";
import type { ModuleProps } from "./types";

function dayDiff(event: CalendarEvent): number {
  const startDate = new Date(event.start);
  const eventDay = event.allDay
    ? Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
    : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((eventDay - today) / 86_400_000);
}

function formatEventDate(event: CalendarEvent): string {
  const startDate = new Date(event.start);
  return startDate.toLocaleDateString(undefined, {
    timeZone: event.allDay ? "UTC" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupLabelFor(event: CalendarEvent): string {
  return dayDiff(event) <= 0 ? "Today" : formatEventDate(event);
}

function groupKeyFor(event: CalendarEvent): string {
  if (dayDiff(event) <= 0) return "today";
  const startDate = new Date(event.start);
  return event.allDay
    ? `date:${startDate.getUTCFullYear()}-${startDate.getUTCMonth()}-${startDate.getUTCDate()}`
    : `date:${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const start = new Date(event.start).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(event.end).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${start} – ${end}`;
}

type EventRow =
  | { type: "header"; key: string; label: string }
  | { type: "event"; key: string; event: CalendarEvent };

function groupEventsIntoRows(events: CalendarEvent[]): EventRow[] {
  const rows: EventRow[] = [];
  let lastGroupKey: string | null = null;
  for (const event of events) {
    const groupKey = groupKeyFor(event);
    if (groupKey !== lastGroupKey) {
      rows.push({ type: "header", key: `header-${groupKey}`, label: groupLabelFor(event) });
      lastGroupKey = groupKey;
    }
    rows.push({ type: "event", key: event.id, event });
  }
  return rows;
}

export function GoogleCalendarListModule({ moduleId, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.googleCalendarList * 60_000;
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.isGoogleCalendarAuthenticated().then((value) => {
      setAuthenticated(value);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    function fetchEvents(): void {
      window.api
        .listGoogleCalendarEvents()
        .then((result) => {
          if (cancelled) return;
          setEvents(result);
          setError(null);
          setCached(googleCalendarListCacheKey(moduleId), result, refreshIntervalMs);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }

    fetchEvents();
    const interval = setInterval(fetchEvents, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authenticated, refreshIntervalMs]);

  function connect(): void {
    setConnecting(true);
    setConnectError(null);
    window.api
      .authenticateGoogleCalendar()
      .then(() => {
        setConnecting(false);
        setAuthenticated(true);
      })
      .catch((err: unknown) => {
        setConnecting(false);
        setConnectError(err instanceof Error ? err.message : String(err));
      });
  }

  if (!authChecked) {
    return <p>Loading…</p>;
  }

  if (!authenticated) {
    return (
      <div className="gcal-connect">
        <p className="module-placeholder">Not connected to Google Calendar.</p>
        <button onClick={connect} disabled={connecting}>
          {connecting ? "Waiting for Google sign-in…" : "Connect Google Calendar"}
        </button>
        {connectError && <p className="module-error">Error: {connectError}</p>}
      </div>
    );
  }

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!events) {
    return <p>Loading…</p>;
  }

  if (events.length === 0) {
    return <p className="module-placeholder">No upcoming events.</p>;
  }

  const rows = groupEventsIntoRows(events);

  return (
    <ul className="gcal-list">
      {rows.map((row) => {
        if (row.type === "header") {
          return (
            <li key={row.key} className="gcal-group-header">
              {row.label}
            </li>
          );
        }

        const { event } = row;
        return (
          <li key={event.id} data-search-item-id={event.id} className="gcal-item">
            <div className="gcal-body">
              <a className="gcal-title" href={event.htmlLink} target="_blank" rel="noreferrer">
                {event.title}
              </a>
              <div className="repo-meta">
                <span>{formatEventTime(event)}</span>
                {event.location && <span>{event.location}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
