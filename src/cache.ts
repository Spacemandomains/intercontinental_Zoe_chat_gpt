import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  max?: number;
  ttl: number;
}

export function createCache<V extends NonNullable<unknown>>(options: CacheOptions): LRUCache<string, V> {
  return new LRUCache<string, V>({
    max: options.max ?? 500,
    ttl: options.ttl,
    allowStale: false,
    updateAgeOnGet: false,
  });
}

export async function wrap<V extends NonNullable<unknown>>(
  cache: LRUCache<string, V>,
  key: string,
  loader: () => Promise<V>,
): Promise<V> {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = await loader();
  cache.set(key, value);
  return value;
}
