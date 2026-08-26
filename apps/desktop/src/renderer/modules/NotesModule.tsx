import { useEffect, useRef, useState } from "react";
import type { ModuleProps } from "./types";

const SAVE_DEBOUNCE_MS = 500;

export function NotesModule({ moduleId }: ModuleProps) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.getNotes().then((notes) => {
      setText(notes[moduleId] ?? "");
      setLoaded(true);
    });
  }, [moduleId]);

  function handleChange(value: string): void {
    setText(value);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = setTimeout(() => {
      window.api.saveNote(moduleId, value);
    }, SAVE_DEBOUNCE_MS);
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <textarea
      className="notes-textarea"
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      placeholder="Type a note…"
    />
  );
}
