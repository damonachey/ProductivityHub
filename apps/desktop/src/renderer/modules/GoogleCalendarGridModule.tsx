import { useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "@productivityhub/google-calendar";
import { setCached } from "../cache";
import { googleCalendarGridCacheKey } from "../search";
import type { ModuleProps } from "./types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS_PER_DAY = 3;

function startOfDay(year: number, month: number, day: number): Date {
  return new Date(year, month, day);
}

// Sunday-start grid covering the full weeks that touch this month, so the
// calendar always renders complete rows (5 or 6 depending on the month).
function getMonthGridDays(year: number, month: number): Date[] {
  const firstOfMonth = startOfDay(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((daysInMonth + startOffset) / 7) * 7;

  const days: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    days.push(startOfDay(year, month, 1 - startOffset + i));
  }
  return days;
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

// All-day events come back as bare dates (interpreted as UTC midnight);
// timed events carry a real timezone offset - use the field that matches.
function eventDayKey(event: CalendarEvent): string {
  const start = new Date(event.start);
  return event.allDay
    ? dayKey(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
    : dayKey(start.getFullYear(), start.getMonth(), start.getDate());
}

function formatEventTimeShort(event: CalendarEvent): string {
  if (event.allDay) return "";
  const start = new Date(event.start);
  const hour24 = start.getHours();
  const minute = start.getMinutes();
  const suffix = hour24 >= 12 ? "p" : "a";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0 ? `${hour12}${suffix}` : `${hour12}:${String(minute).padStart(2, "0")}${suffix}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function GoogleCalendarGridModule({ moduleId, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.googleCalendarGrid * 60_000;
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const gridDays = useMemo(() => getMonthGridDays(year, month), [year, month]);

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
      const first = gridDays[0];
      const last = gridDays[gridDays.length - 1];
      // Pad a day on each side so a timezone shift can't drop an event that
      // actually belongs to a day right at the edge of the visible grid.
      const timeMin = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 1);
      const timeMax = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 2);

      window.api
        .listGoogleCalendarEventsInRange(timeMin.toISOString(), timeMax.toISOString())
        .then((result) => {
          if (cancelled) return;
          setEvents(result);
          setError(null);
          setCached(googleCalendarGridCacheKey(moduleId), result, refreshIntervalMs);
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
  }, [authenticated, gridDays, refreshIntervalMs]);

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

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events ?? []) {
    const key = eventDayKey(event);
    const bucket = eventsByDay.get(key);
    if (bucket) bucket.push(event);
    else eventsByDay.set(key, [event]);
  }

  const today = new Date();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="gcal-grid-module">
      <div className="gcal-grid-nav">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Previous month">
          ‹
        </button>
        <span className="gcal-grid-month-label">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Next month">
          ›
        </button>
        <button className="gcal-grid-today" onClick={() => setViewDate(new Date())}>
          Today
        </button>
      </div>

      {!events ? (
        <p>Loading…</p>
      ) : (
        <div className="gcal-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="gcal-grid-weekday">
              {label}
            </div>
          ))}
          {gridDays.map((day) => {
            const key = dayKey(day.getFullYear(), day.getMonth(), day.getDate());
            const dayEvents = eventsByDay.get(key) ?? [];
            const visible = dayEvents.slice(0, MAX_VISIBLE_EVENTS_PER_DAY);
            const overflow = dayEvents.length - visible.length;

            return (
              <div
                key={key}
                className={[
                  "gcal-grid-day",
                  day.getMonth() !== month && "gcal-grid-day-outside",
                  isSameDay(day, today) && "gcal-grid-day-today",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="gcal-grid-day-number">{day.getDate()}</span>
                <div className="gcal-grid-day-events">
                  {visible.map((event) => (
                    <a
                      key={event.id}
                      data-search-item-id={event.id}
                      className="gcal-grid-event"
                      href={event.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      title={event.title}
                    >
                      {!event.allDay && (
                        <span className="gcal-grid-event-time">{formatEventTimeShort(event)}</span>
                      )}
                      <span className="gcal-grid-event-title">{event.title}</span>
                    </a>
                  ))}
                  {overflow > 0 && <span className="gcal-grid-more">+{overflow} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
