import { useEffect, useState } from "react";

interface Props {
  enabled: boolean;
}

// Browser-style status bar: shows the href of whatever link is under the
// cursor. A single delegated "mouseover" listener is enough - it already
// fires on every element the cursor enters, including non-link elements,
// which is exactly when the bar should clear.
export function LinkStatusBar({ enabled }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }

    function handleMouseOver(event: MouseEvent): void {
      const link = (event.target as HTMLElement | null)?.closest("a[href]");
      setUrl(link?.getAttribute("href") ?? null);
    }

    window.addEventListener("mouseover", handleMouseOver);
    return () => {
      window.removeEventListener("mouseover", handleMouseOver);
      setUrl(null);
    };
  }, [enabled]);

  if (!url) return null;

  return <div className="link-status-bar">{url}</div>;
}
