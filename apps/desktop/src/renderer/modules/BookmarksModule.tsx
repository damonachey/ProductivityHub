import { useEffect, useState } from "react";
import type { BookmarkItem } from "../../types";
import type { ModuleProps } from "./types";

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function displayTitle(item: BookmarkItem): string {
  if (item.title) return item.title;
  try {
    return new URL(item.url).hostname.replace(/^www\./, "");
  } catch {
    return item.url;
  }
}

export function BookmarksModule({ moduleId, lockLayout }: ModuleProps) {
  const [items, setItems] = useState<BookmarkItem[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    window.api.getBookmarks().then((bookmarks) => {
      setItems(bookmarks[moduleId] ?? []);
    });
  }, [moduleId]);

  useEffect(() => {
    if (lockLayout) {
      setEditingId(null);
      setAddingOpen(false);
    }
  }, [lockLayout]);

  function persist(next: BookmarkItem[]): void {
    setItems(next);
    window.api.saveBookmarks(moduleId, next);
  }

  function startAdd(): void {
    if (lockLayout) return;
    setNewUrl("");
    setNewTitle("");
    setAddingOpen(true);
  }

  function commitAdd(): void {
    const url = normalizeUrl(newUrl);
    if (!url || !items) {
      setAddingOpen(false);
      return;
    }
    const title = newTitle.trim();
    persist([...items, { id: crypto.randomUUID(), url, title: title || undefined }]);
    setAddingOpen(false);
  }

  function startEdit(item: BookmarkItem): void {
    if (lockLayout) return;
    setEditingId(item.id);
    setEditUrl(item.url);
    setEditTitle(item.title ?? "");
  }

  function commitEdit(): void {
    if (!items || !editingId) return;
    const url = normalizeUrl(editUrl);
    if (!url) {
      setEditingId(null);
      return;
    }
    const title = editTitle.trim();
    persist(
      items.map((item) =>
        item.id === editingId ? { ...item, url, title: title || undefined } : item,
      ),
    );
    setEditingId(null);
  }

  function removeItem(id: string): void {
    if (!items || lockLayout) return;
    persist(items.filter((item) => item.id !== id));
  }

  function reorder(draggedItemId: string, targetId: string): void {
    if (!items || lockLayout) return;
    const fromIndex = items.findIndex((item) => item.id === draggedItemId);
    const toIndex = items.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
  }

  if (!items) {
    return <p>Loading…</p>;
  }

  return (
    <div className="bookmarks">
      {items.length === 0 && !addingOpen && (
        <p className="module-placeholder">No bookmarks yet.</p>
      )}

      <ul className="bookmark-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={[
              "bookmark-item",
              item.id === draggedId && "dragging",
              item.id === dragOverId && "drag-over",
            ]
              .filter(Boolean)
              .join(" ")}
            draggable={!lockLayout && editingId !== item.id}
            onDragStart={() => setDraggedId(item.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggedId && draggedId !== item.id) {
                setDragOverId(item.id);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedId && draggedId !== item.id) {
                reorder(draggedId, item.id);
              }
              setDraggedId(null);
              setDragOverId(null);
            }}
          >
            {editingId === item.id ? (
              <div className="bookmark-edit-form">
                <input
                  className="bookmark-input"
                  autoFocus
                  placeholder="URL"
                  value={editUrl}
                  onChange={(event) => setEditUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitEdit();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
                <input
                  className="bookmark-input"
                  placeholder="Title (optional)"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitEdit();
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="bookmark-edit-actions">
                  <button onClick={commitEdit}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {!lockLayout && (
                  <span className="bookmark-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                )}
                <a
                  className="bookmark-link"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title={item.url}
                >
                  {displayTitle(item)}
                </a>
                {!lockLayout && (
                  <div className="bookmark-actions">
                    <button
                      aria-label={`Edit ${displayTitle(item)}`}
                      onClick={() => startEdit(item)}
                    >
                      ✎
                    </button>
                    <button
                      aria-label={`Remove ${displayTitle(item)}`}
                      onClick={() => removeItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {!lockLayout &&
        (addingOpen ? (
          <div className="bookmark-add-form">
            <input
              className="bookmark-input"
              autoFocus
              placeholder="URL"
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd();
                if (event.key === "Escape") setAddingOpen(false);
              }}
            />
            <input
              className="bookmark-input"
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd();
                if (event.key === "Escape") setAddingOpen(false);
              }}
            />
            <div className="bookmark-edit-actions">
              <button onClick={commitAdd}>Add</button>
              <button onClick={() => setAddingOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="bookmark-add-button" onClick={startAdd}>
            + Add bookmark
          </button>
        ))}
    </div>
  );
}
