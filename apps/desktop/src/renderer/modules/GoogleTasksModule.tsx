import { useEffect, useState } from "react";
import type { GoogleTask } from "@productivityhub/google-tasks";
import { setCached } from "../cache";
import { registerPendingFlush, unregisterPendingFlush } from "../pendingActions";
import { googleTasksCacheKey } from "../search";
import type { ModuleProps } from "./types";

// How long a completion toggle waits, undoable, before it's actually sent.
const PIE_TIMER_MS = 5000;

const DEFAULT_FILTERS = ["pastDue", "today", "tomorrow"];

const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "pastDue", label: "Past due" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "next7", label: "Next 7 days" },
  { key: "next30", label: "Next 30 days" },
  { key: "all", label: "All" },
];

interface PendingCompletion {
  status: GoogleTask["status"];
  timeoutId: ReturnType<typeof setTimeout>;
  startedAt: number;
}

function utcDateOnly(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day);
}

function daysUntilDue(due: string): number {
  const dueDate = new Date(due);
  const dueDay = utcDateOnly(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const now = new Date();
  const today = utcDateOnly(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / 86_400_000);
}

function matchesFilters(task: GoogleTask, filters: string[]): boolean {
  if (filters.includes("all")) return true;
  if (!task.due) return false;
  const diff = daysUntilDue(task.due);
  if (filters.includes("pastDue") && diff < 0) return true;
  if (filters.includes("today") && diff === 0) return true;
  if (filters.includes("tomorrow") && diff === 1) return true;
  if (filters.includes("next7") && diff >= 0 && diff <= 7) return true;
  if (filters.includes("next30") && diff >= 0 && diff <= 30) return true;
  return false;
}

function formatDue(due: string | null): string {
  if (!due) return "";
  const date = new Date(due);
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Groups the (already date-sorted) task list under "Past" / "Today" / one
// header per distinct future date - or "No due date" for undated tasks,
// which only appear at all when the "All" filter is on.
function groupKeyFor(task: GoogleTask): string {
  if (!task.due) return "none";
  const diff = daysUntilDue(task.due);
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  return task.due.slice(0, 10);
}

function groupLabelFor(task: GoogleTask): string {
  if (!task.due) return "No due date";
  const diff = daysUntilDue(task.due);
  if (diff < 0) return "Past";
  if (diff === 0) return "Today";
  return formatDue(task.due);
}

type TaskRow =
  | { type: "header"; key: string; label: string }
  | { type: "task"; key: string; task: GoogleTask };

function groupTasksIntoRows(sortedTasks: GoogleTask[]): TaskRow[] {
  const rows: TaskRow[] = [];
  let lastGroupKey: string | null = null;
  for (const task of sortedTasks) {
    const groupKey = groupKeyFor(task);
    if (groupKey !== lastGroupKey) {
      rows.push({ type: "header", key: `header-${groupKey}`, label: groupLabelFor(task) });
      lastGroupKey = groupKey;
    }
    rows.push({ type: "task", key: task.id, task });
  }
  return rows;
}

export function GoogleTasksModule({ moduleId, lockLayout, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.googleTasks * 60_000;
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GoogleTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<string[]>(DEFAULT_FILTERS);
  const [pending, setPending] = useState<Record<string, PendingCompletion>>({});
  const [addingOpen, setAddingOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDue, setNewDue] = useState("");

  useEffect(() => {
    window.api.isGoogleTasksAuthenticated().then((value) => {
      setAuthenticated(value);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    window.api.getGoogleTasksFilters(moduleId).then((saved) => {
      if (saved) setFilters(saved);
    });
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) setAddingOpen(false);
  }, [lockLayout]);

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    function fetchTasks(): void {
      window.api
        .listGoogleTasks()
        .then((result) => {
          if (cancelled) return;
          setTasks(result);
          setError(null);
          setCached(googleTasksCacheKey(moduleId), result, refreshIntervalMs);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }

    fetchTasks();
    const interval = setInterval(fetchTasks, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authenticated, refreshIntervalMs]);

  function connect(): void {
    setConnecting(true);
    setConnectError(null);
    window.api
      .authenticateGoogleTasks()
      .then(() => {
        setConnecting(false);
        setAuthenticated(true);
      })
      .catch((err: unknown) => {
        setConnecting(false);
        setConnectError(err instanceof Error ? err.message : String(err));
      });
  }

  function toggleFilter(key: string): void {
    const next = filters.includes(key) ? filters.filter((f) => f !== key) : [...filters, key];
    setFilters(next);
    window.api.saveGoogleTasksFilters(moduleId, next);
  }

  function flushKey(taskId: string): string {
    return `google-tasks-${moduleId}-${taskId}`;
  }

  function commitStatus(taskId: string, status: GoogleTask["status"]): Promise<void> {
    return window.api
      .setGoogleTaskStatus(taskId, status)
      .then(() => {
        setTasks((prev) => (prev ? prev.map((t) => (t.id === taskId ? { ...t, status } : t)) : prev));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        unregisterPendingFlush(flushKey(taskId));
        setPending((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
      });
  }

  function toggleCompletion(task: GoogleTask): void {
    const current = pending[task.id];
    if (current) clearTimeout(current.timeoutId);

    const baseStatus = current ? current.status : task.status;
    const nextStatus: GoogleTask["status"] =
      baseStatus === "completed" ? "needsAction" : "completed";

    const timeoutId = setTimeout(() => commitStatus(task.id, nextStatus), PIE_TIMER_MS);
    registerPendingFlush(flushKey(task.id), () => {
      clearTimeout(timeoutId);
      return commitStatus(task.id, nextStatus);
    });
    setPending((prev) => ({ ...prev, [task.id]: { status: nextStatus, timeoutId, startedAt: Date.now() } }));
  }

  function startAdd(): void {
    if (lockLayout) return;
    setNewTitle("");
    setNewNotes("");
    setNewDue("");
    setAddingOpen(true);
  }

  function commitAdd(): void {
    const title = newTitle.trim();
    if (!title) {
      setAddingOpen(false);
      return;
    }
    window.api
      .createGoogleTask({ title, notes: newNotes.trim() || undefined, due: newDue || undefined })
      .then((task) => {
        setTasks((prev) => (prev ? [...prev, task] : [task]));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    setAddingOpen(false);
  }

  function deleteTaskItem(taskId: string): void {
    if (lockLayout) return;
    window.api
      .deleteGoogleTask(taskId)
      .then(() => {
        setTasks((prev) => (prev ? prev.filter((t) => t.id !== taskId) : prev));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }

  if (!authChecked) {
    return <p>Loading…</p>;
  }

  if (!authenticated) {
    return (
      <div className="gtask-connect">
        <p className="module-placeholder">Not connected to Google Tasks.</p>
        <button onClick={connect} disabled={connecting}>
          {connecting ? "Waiting for Google sign-in…" : "Connect Google Tasks"}
        </button>
        {connectError && <p className="module-error">Error: {connectError}</p>}
      </div>
    );
  }

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!tasks) {
    return <p>Loading…</p>;
  }

  const visibleTasks = tasks
    .filter((task) => {
      // Visibility follows the confirmed server status, not the optimistic
      // pending one - a task marked complete stays in view, pie ticking,
      // for the full undo window and only disappears once the completion
      // actually commits (or forever if you toggle it back in time).
      if (task.status === "completed") return false;
      return matchesFilters(task, filters);
    })
    .sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });

  const rows = groupTasksIntoRows(visibleTasks);

  return (
    <div className="gtasks">
      <div className="gtask-filters">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            className={filters.includes(option.key) ? "gtask-filter gtask-filter-active" : "gtask-filter"}
            onClick={() => toggleFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 && !addingOpen && (
        <p className="module-placeholder">No tasks match the selected filters.</p>
      )}

      <ul className="gtask-list">
        {rows.map((row) => {
          if (row.type === "header") {
            return (
              <li key={row.key} className="gtask-group-header">
                {row.label}
              </li>
            );
          }

          const task = row.task;
          const pendingEntry = pending[task.id];
          const effectiveCompleted = (pendingEntry?.status ?? task.status) === "completed";
          return (
            <li key={task.id} data-search-item-id={task.id} className="gtask-item">
              <button
                key={pendingEntry?.startedAt ?? "static"}
                className={[
                  "gtask-checkbox",
                  effectiveCompleted && "gtask-checkbox-checked",
                  pendingEntry && "gtask-checkbox-pending",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={effectiveCompleted ? "Mark as not completed" : "Mark as completed"}
                title={effectiveCompleted ? "Mark as not completed" : "Mark as completed"}
                onClick={() => toggleCompletion(task)}
              />
              <div className={effectiveCompleted ? "gtask-body gtask-body-completing" : "gtask-body"}>
                <a
                  className="gtask-title"
                  href="https://tasks.google.com/tasks/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {task.title}
                </a>
                {task.notes && <p className="gtask-notes">{task.notes}</p>}
                {task.due && <span className="gtask-due">{formatDue(task.due)}</span>}
              </div>
              {!lockLayout && (
                <button
                  className="gtask-delete"
                  aria-label={`Delete ${task.title}`}
                  title="Delete"
                  onClick={() => deleteTaskItem(task.id)}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!lockLayout &&
        (addingOpen ? (
          <div className="gtask-add-form">
            <input
              className="gtask-input"
              autoFocus
              placeholder="Title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setAddingOpen(false);
              }}
            />
            <textarea
              className="gtask-textarea"
              placeholder="Details (optional)"
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
            />
            <input
              className="gtask-input"
              type="date"
              value={newDue}
              onChange={(event) => setNewDue(event.target.value)}
            />
            <div className="gtask-add-actions">
              <button onClick={commitAdd}>Add</button>
              <button onClick={() => setAddingOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="gtask-add-button" onClick={startAdd}>
            + Add task
          </button>
        ))}
    </div>
  );
}
