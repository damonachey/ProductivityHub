import { useEffect, useState } from "react";
import type { NotificationSummary } from "@productivityhub/github";

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatReason(reason: string): string {
  return reason.replace(/_/g, " ");
}

export function GithubNotificationsModule() {
  const [notifications, setNotifications] = useState<NotificationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .listNotifications()
      .then(setNotifications)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return <p className="module-error">Error: {error}</p>;
  }

  if (!notifications) {
    return <p>Loading…</p>;
  }

  if (notifications.length === 0) {
    return <p className="module-placeholder">No notifications.</p>;
  }

  return (
    <ul className="repo-list">
      {notifications.map((notification) => (
        <li key={notification.id} className="repo-item">
          <a className="repo-name" href={notification.url} target="_blank" rel="noreferrer">
            {notification.title}
          </a>
          <div className="repo-meta">
            {notification.unread && <span className="repo-badge">Unread</span>}
            <span>{notification.repository}</span>
            <span>{formatReason(notification.reason)}</span>
            <span>Updated {formatDate(notification.updatedAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
