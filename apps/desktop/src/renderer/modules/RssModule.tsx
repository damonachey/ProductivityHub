import { useEffect, useState } from "react";
import type { RssFeedError, RssItem } from "@productivityhub/rss";
import type { RssFeedConfig, RssModuleSettings } from "../../types";
import { getCached, setCached } from "../cache";
import { rssCacheKey } from "../search";
import type { ModuleProps } from "./types";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDate(publishedAt: string | null): string {
  if (!publishedAt) return "unknown";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RssModule({ moduleId, lockLayout, refreshIntervalsMinutes }: ModuleProps) {
  const refreshIntervalMs = refreshIntervalsMinutes.rss * 60_000;
  const [settings, setSettings] = useState<RssModuleSettings | null>(null);
  const [items, setItems] = useState<RssItem[] | null>(
    () => getCached<RssItem[]>(rssCacheKey(moduleId)) ?? null,
  );
  const [errors, setErrors] = useState<RssFeedError[]>([]);

  const [addingOpen, setAddingOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draftMaxItems, setDraftMaxItems] = useState("");
  const [draftMaxAgeDays, setDraftMaxAgeDays] = useState("");

  useEffect(() => {
    window.api.getRssSettings(moduleId).then((saved) => {
      setSettings(saved);
      setDraftMaxItems(String(saved.maxItems));
      setDraftMaxAgeDays(String(saved.maxAgeDays));
    });
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) {
      setEditingId(null);
      setAddingOpen(false);
    }
  }, [lockLayout]);

  useEffect(() => {
    if (!settings || settings.feeds.length === 0) {
      setItems([]);
      setErrors([]);
      return;
    }

    let cancelled = false;

    function fetchItems(): void {
      window.api.getRssItems(moduleId).then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setErrors(result.errors);
        setCached(rssCacheKey(moduleId), result.items, refreshIntervalMs);
      });
    }

    fetchItems();
    const interval = setInterval(fetchItems, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings, moduleId, refreshIntervalMs]);

  function persist(next: RssModuleSettings): void {
    setSettings(next);
    window.api.saveRssSettings(moduleId, next);
  }

  function startAdd(): void {
    if (lockLayout) return;
    setNewUrl("https://");
    setNewTitle("");
    setAddingOpen(true);
  }

  function commitAdd(): void {
    const url = normalizeUrl(newUrl);
    if (!url || /^[a-z][a-z0-9+.-]*:\/\/$/i.test(url) || !settings) {
      setAddingOpen(false);
      return;
    }
    const title = newTitle.trim();
    const feed: RssFeedConfig = { id: crypto.randomUUID(), url, title: title || undefined };
    persist({ ...settings, feeds: [...settings.feeds, feed] });
    setAddingOpen(false);
  }

  function startEdit(feed: RssFeedConfig): void {
    if (lockLayout) return;
    setEditingId(feed.id);
    setEditUrl(feed.url);
    setEditTitle(feed.title ?? "");
  }

  function commitEdit(): void {
    if (!settings || !editingId) return;
    const url = normalizeUrl(editUrl);
    if (!url) {
      setEditingId(null);
      return;
    }
    const title = editTitle.trim();
    persist({
      ...settings,
      feeds: settings.feeds.map((feed) =>
        feed.id === editingId ? { ...feed, url, title: title || undefined } : feed,
      ),
    });
    setEditingId(null);
  }

  function removeFeed(id: string): void {
    if (!settings || lockLayout) return;
    persist({ ...settings, feeds: settings.feeds.filter((feed) => feed.id !== id) });
  }

  function reorder(draggedFeedId: string, targetId: string): void {
    if (!settings || lockLayout) return;
    const fromIndex = settings.feeds.findIndex((feed) => feed.id === draggedFeedId);
    const toIndex = settings.feeds.findIndex((feed) => feed.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...settings.feeds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist({ ...settings, feeds: next });
  }

  function commitOptions(): void {
    if (!settings) return;
    const maxItems = Math.max(1, Number.parseInt(draftMaxItems, 10) || settings.maxItems);
    const maxAgeDays = Math.max(0, Number.parseInt(draftMaxAgeDays, 10) || 0);
    setDraftMaxItems(String(maxItems));
    setDraftMaxAgeDays(String(maxAgeDays));
    if (maxItems === settings.maxItems && maxAgeDays === settings.maxAgeDays) return;
    persist({ ...settings, maxItems, maxAgeDays });
  }

  if (!settings) {
    return <p>Loading…</p>;
  }

  return (
    <div className="rss-module">
      {!lockLayout && (
        <>
          <ul className="rss-feed-list">
            {settings.feeds.map((feed) => (
              <li
                key={feed.id}
                className={[
                  "rss-feed-item",
                  feed.id === draggedId && "dragging",
                  feed.id === dragOverId && "drag-over",
                ]
                  .filter(Boolean)
                  .join(" ")}
                draggable={editingId !== feed.id}
                onDragStart={() => setDraggedId(feed.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedId && draggedId !== feed.id) {
                    setDragOverId(feed.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId && draggedId !== feed.id) {
                    reorder(draggedId, feed.id);
                  }
                  setDraggedId(null);
                  setDragOverId(null);
                }}
              >
                {editingId === feed.id ? (
                  <div className="rss-feed-edit-form">
                    <input
                      className="rss-input"
                      autoFocus
                      placeholder="Feed URL"
                      value={editUrl}
                      onChange={(event) => setEditUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitEdit();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                    <input
                      className="rss-input"
                      placeholder="Title (optional)"
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitEdit();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                    <div className="rss-feed-edit-actions">
                      <button onClick={commitEdit}>Save</button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="rss-feed-drag-handle" aria-hidden="true">
                      ⠿
                    </span>
                    <span className="rss-feed-label" title={feed.url}>
                      {feed.title || feed.url}
                    </span>
                    <div className="rss-feed-actions">
                      <button aria-label={`Edit ${feed.title || feed.url}`} onClick={() => startEdit(feed)}>
                        ✎
                      </button>
                      <button
                        aria-label={`Remove ${feed.title || feed.url}`}
                        onClick={() => removeFeed(feed.id)}
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {addingOpen ? (
            <div className="rss-feed-add-form">
              <input
                className="rss-input"
                autoFocus
                placeholder="Feed URL"
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                onFocus={(event) => {
                  const { value } = event.target;
                  event.target.setSelectionRange(value.length, value.length);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitAdd();
                  if (event.key === "Escape") setAddingOpen(false);
                }}
              />
              <input
                className="rss-input"
                placeholder="Title (optional)"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitAdd();
                  if (event.key === "Escape") setAddingOpen(false);
                }}
              />
              <div className="rss-feed-edit-actions">
                <button onClick={commitAdd}>Add</button>
                <button onClick={() => setAddingOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="rss-feed-add-button" onClick={startAdd}>
              + Add feed
            </button>
          )}

          <div className="rss-options-form">
            <label>
              Items
              <input
                className="rss-options-input"
                type="number"
                min={1}
                value={draftMaxItems}
                onChange={(event) => setDraftMaxItems(event.target.value)}
                onBlur={commitOptions}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitOptions();
                }}
              />
            </label>
            <label>
              Max age (days, 0 = no limit)
              <input
                className="rss-options-input"
                type="number"
                min={0}
                value={draftMaxAgeDays}
                onChange={(event) => setDraftMaxAgeDays(event.target.value)}
                onBlur={commitOptions}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitOptions();
                }}
              />
            </label>
          </div>
        </>
      )}

      {errors.length > 0 && (
        <p className="module-error">
          {errors.length === 1
            ? `Couldn't load ${errors[0].title}: ${errors[0].message}`
            : `Couldn't load ${errors.length} feeds: ${errors.map((error) => error.title).join(", ")}`}
        </p>
      )}

      {settings.feeds.length === 0 ? (
        <p className="module-placeholder">Add a feed URL above.</p>
      ) : !items ? (
        <p>Loading…</p>
      ) : items.length === 0 && errors.length === 0 ? (
        <p className="module-placeholder">No items.</p>
      ) : (
        <ul className="repo-list">
          {items.map((item) => (
            <li key={item.id} data-search-item-id={item.id} className="repo-item">
              <a className="repo-name" href={item.link} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <div className="repo-meta">
                <span>{item.feedTitle}</span>
                <span>{formatDate(item.publishedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
