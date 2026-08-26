import { useEffect, useRef, useState } from "react";
import type { Rect } from "../../types";
import type { ModuleProps } from "./types";

const BOUNDS_POLL_MS = 300;

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function boundsEqual(a: Rect | null, b: Rect): boolean {
  return !!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function WebPageModule({ moduleId }: ModuleProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputFocusedRef = useRef(false);
  const lastBoundsRef = useRef<Rect | null>(null);
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.api.getWebPageUrl(moduleId).then((savedUrl) => {
      setUrl(savedUrl);
      setLoaded(true);
    });
  }, [moduleId]);

  useEffect(() => {
    if (!loaded) return;
    return window.api.onWebPageNavigated((navModuleId, navUrl) => {
      if (navModuleId !== moduleId || inputFocusedRef.current) return;
      setUrl(navUrl);
    });
  }, [moduleId, loaded]);

  useEffect(() => {
    if (!loaded) return;

    function syncBounds(): void {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const bounds: Rect = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      if (boundsEqual(lastBoundsRef.current, bounds)) return;
      lastBoundsRef.current = bounds;
      window.api.syncWebPage(moduleId, bounds);
    }

    syncBounds();
    const interval = setInterval(syncBounds, BOUNDS_POLL_MS);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
      window.api.hideWebPage(moduleId);
    };
  }, [moduleId, loaded]);

  function navigate(target: string): void {
    const normalized = normalizeUrl(target);
    if (!normalized) return;
    setUrl(normalized);
    window.api.navigateWebPage(moduleId, normalized);
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <div className="webpage-module">
      <div className="webpage-toolbar">
        <button aria-label="Back" onClick={() => window.api.webPageGoBack(moduleId)}>
          ←
        </button>
        <button aria-label="Forward" onClick={() => window.api.webPageGoForward(moduleId)}>
          →
        </button>
        <button aria-label="Reload" onClick={() => window.api.webPageReload(moduleId)}>
          ⟳
        </button>
        <input
          className="webpage-address-input"
          value={url}
          placeholder="Enter a URL…"
          onFocus={() => {
            inputFocusedRef.current = true;
          }}
          onBlur={() => {
            inputFocusedRef.current = false;
          }}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(url);
          }}
        />
      </div>
      <div className="webpage-viewport" ref={viewportRef} />
    </div>
  );
}
