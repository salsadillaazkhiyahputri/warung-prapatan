/**
 * Client-side in-memory cache for fast SPA page transitions.
 * Eliminates loading flashes when navigating between dashboard pages.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getClientCache<T>(key: string, maxAgeMs = 120_000): T | null {
  if (typeof window === 'undefined') return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setClientCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  store.set(key, { data, timestamp: Date.now() });
}

export function invalidateClientCache(prefix?: string): void {
  if (typeof window === 'undefined') return;
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) {
      store.delete(k);
    }
  }
}
