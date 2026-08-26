import { useEffect, useState } from "react";
import { getCached, setCached } from "./cache";

interface CachedDataResult<T> {
  data: T | null;
  error: string | null;
}

// Modules call this instead of fetching directly: on mount it checks the
// cache first and uses that value if it isn't stale, only calling `fetcher`
// when there's nothing cached (or it expired), then caches the result for
// `ttlMs`. Each caller picks its own key and ttlMs, so different modules can
// have different cache lifetimes.
export function useCachedData<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): CachedDataResult<T> {
  const [data, setData] = useState<T | null>(() => getCached<T>(key) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getCached<T>(key) !== undefined) {
      return;
    }

    let cancelled = false;

    fetcher()
      .then((result) => {
        if (cancelled) return;
        setCached(key, result, ttlMs);
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, error };
}
