/**
 * Client-side in-memory & sessionStorage cache for instant page loads.
 * Eliminates loading flashes when navigating between dashboard pages or refreshing tabs.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getClientCache<T>(key: string, maxAgeMs = 180_000): T | null {
  if (typeof window === 'undefined') return null;

  // 1. Cek in-memory store
  const entry = store.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp > maxAgeMs) {
      store.delete(key);
    } else {
      return entry.data as T;
    }
  }

  // 2. Cek sessionStorage fallback
  try {
    const raw = sessionStorage.getItem(`wp_cache_${key}`);
    if (raw) {
      const parsed: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - parsed.timestamp <= maxAgeMs) {
        store.set(key, parsed as CacheEntry<unknown>);
        return parsed.data;
      } else {
        sessionStorage.removeItem(`wp_cache_${key}`);
      }
    }
  } catch {
    // sessionStorage bisa diblokir pada mode privat
  }

  return null;
}

export function setClientCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  const entry = { data, timestamp: Date.now() };
  store.set(key, entry as CacheEntry<unknown>);
  try {
    sessionStorage.setItem(`wp_cache_${key}`, JSON.stringify(entry));
  } catch {
    // Abaikan jika storage penuh
  }
}

export function invalidateClientCache(prefix?: string): void {
  if (typeof window === 'undefined') return;
  if (!prefix) {
    store.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('wp_cache_')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {}
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) {
      store.delete(k);
    }
  }
  try {
    const fullPrefix = `wp_cache_${prefix}`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
