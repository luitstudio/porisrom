// Server-only request coalescing. Cookie writes must happen in a route/action.
export function createRefreshCoordinator<T>() {
  const pending = new Map<string, { until: number; result: Promise<T> }>();
  return (token: string, refresh: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    for (const [key, value] of pending) if (value.until <= now) pending.delete(key);
    const existing = pending.get(token);
    if (existing) return existing.result;
    const entry = { until: Number.POSITIVE_INFINITY, result: Promise.resolve().then(refresh) };
    pending.set(token, entry);
    entry.result.then(() => { entry.until = Date.now() + 5000; }, () => { pending.delete(token); });
    return entry.result;
  };
}
