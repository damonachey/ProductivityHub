import { useEffect, useState } from "react";
import type { GmailThreadSummary } from "@productivityhub/google-mail";
import { setCached } from "../cache";
import { gmailInboxCacheKey } from "../search";
import type { ModuleProps } from "./types";

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function OpenEnvelopeIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M2 6.5v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6" />
      <path d="M2 6.5h12" />
      <path d="M2 6.5l6-4 6 4" />
    </svg>
  );
}

function ClosedEnvelopeIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M2 5.5h12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z" />
      <path d="M2 5.5l6 4 6-4" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M2 6h12v6.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6z" />
      <path d="M2 6V3.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1V6" />
      <path d="M8 8v3.5M6.3 10l1.7 1.7L9.7 10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M3 4.5h10" />
      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M4.5 4.5l.6 8.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.5" />
      <path d="M6.7 7v4M9.3 7v4" />
    </svg>
  );
}

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*<[^>]+>$/);
  return match ? match[1].trim() : from;
}

function formatDate(raw: string | null): string {
  if (!raw) return "unknown";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "unknown";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function GmailInboxModule({ moduleId, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.gmailInbox * 60_000;
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [threads, setThreads] = useState<GmailThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    window.api.isGmailAuthenticated().then((value) => {
      setAuthenticated(value);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    function fetchThreads(): void {
      window.api
        .listGmailThreads()
        .then((result) => {
          if (cancelled) return;
          setThreads(result);
          setError(null);
          setCached(gmailInboxCacheKey(moduleId), result, refreshIntervalMs);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }

    fetchThreads();
    const interval = setInterval(fetchThreads, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authenticated, refreshIntervalMs]);

  function connect(): void {
    setConnecting(true);
    setConnectError(null);
    window.api
      .authenticateGmail()
      .then(() => {
        setConnecting(false);
        setAuthenticated(true);
      })
      .catch((err: unknown) => {
        setConnecting(false);
        setConnectError(err instanceof Error ? err.message : String(err));
      });
  }

  function withPending(id: string, action: () => Promise<void>): void {
    setPendingIds((prev) => new Set(prev).add(id));
    action()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }

  function markRead(thread: GmailThreadSummary): void {
    withPending(thread.id, async () => {
      await window.api.markGmailThreadRead(thread.id);
      setThreads((prev) =>
        prev ? prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t)) : prev,
      );
    });
  }

  function markUnread(thread: GmailThreadSummary): void {
    withPending(thread.id, async () => {
      await window.api.markGmailThreadUnread(thread.id);
      setThreads((prev) =>
        prev ? prev.map((t) => (t.id === thread.id ? { ...t, unread: true } : t)) : prev,
      );
    });
  }

  function archive(thread: GmailThreadSummary): void {
    withPending(thread.id, async () => {
      await window.api.archiveGmailThread(thread.id);
      setThreads((prev) => (prev ? prev.filter((t) => t.id !== thread.id) : prev));
    });
  }

  function trash(thread: GmailThreadSummary): void {
    withPending(thread.id, async () => {
      await window.api.trashGmailThread(thread.id);
      setThreads((prev) => (prev ? prev.filter((t) => t.id !== thread.id) : prev));
    });
  }

  if (!authChecked) {
    return <p>Loading…</p>;
  }

  if (!authenticated) {
    return (
      <div className="gmail-connect">
        <p className="module-placeholder">Not connected to Gmail.</p>
        <button onClick={connect} disabled={connecting}>
          {connecting ? "Waiting for Google sign-in…" : "Connect Gmail"}
        </button>
        {connectError && <p className="module-error">Error: {connectError}</p>}
      </div>
    );
  }

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!threads) {
    return <p>Loading…</p>;
  }

  if (threads.length === 0) {
    return <p className="module-placeholder">Inbox zero.</p>;
  }

  return (
    <ul className="gmail-thread-list">
      {threads.map((thread) => {
        const isPending = pendingIds.has(thread.id);
        return (
          <li
            key={thread.id}
            className={thread.unread ? "gmail-thread-item gmail-unread" : "gmail-thread-item"}
          >
            <div className="gmail-thread-header">
              <a
                className="gmail-thread-link"
                href={`https://mail.google.com/mail/u/0/#inbox/${thread.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="gmail-thread-from-meta">
                  <span className="gmail-from">{formatFrom(thread.from)}</span>
                  <span className="gmail-date">{formatDate(thread.date)}</span>
                  {thread.messageCount > 1 && (
                    <span className="gmail-count">{thread.messageCount} messages</span>
                  )}
                </div>
                <span className="gmail-subject">{thread.subject}</span>
              </a>
              <div className="gmail-thread-actions">
                {thread.unread ? (
                  <button
                    aria-label="Mark as read"
                    title="Mark as read"
                    disabled={isPending}
                    onClick={() => markRead(thread)}
                  >
                    <OpenEnvelopeIcon />
                  </button>
                ) : (
                  <button
                    aria-label="Mark as unread"
                    title="Mark as unread"
                    disabled={isPending}
                    onClick={() => markUnread(thread)}
                  >
                    <ClosedEnvelopeIcon />
                  </button>
                )}
                <button
                  aria-label="Archive"
                  title="Archive"
                  disabled={isPending}
                  onClick={() => archive(thread)}
                >
                  <ArchiveIcon />
                </button>
                <button
                  aria-label="Delete"
                  title="Delete"
                  disabled={isPending}
                  onClick={() => trash(thread)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
            <p className="gmail-snippet">{thread.snippet}</p>
          </li>
        );
      })}
    </ul>
  );
}
