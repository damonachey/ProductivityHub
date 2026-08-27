// A module-scope (not component-scope) registry so an app-quit flush can
// find and commit any in-flight "pie timer" style debounced actions - e.g.
// a Google Tasks completion toggle waiting out its undo window - regardless
// of which component registered them or whether that component is still
// mounted (switching workspace tabs unmounts modules, but a pending timer
// keeps running in the background until it commits or is flushed).
type FlushFn = () => Promise<void>;

const pendingFlushes = new Map<string, FlushFn>();

export function registerPendingFlush(key: string, fn: FlushFn): void {
  pendingFlushes.set(key, fn);
}

export function unregisterPendingFlush(key: string): void {
  pendingFlushes.delete(key);
}

export async function flushAllPending(): Promise<void> {
  const fns = [...pendingFlushes.values()];
  pendingFlushes.clear();
  await Promise.all(fns.map((fn) => fn().catch(() => undefined)));
}
