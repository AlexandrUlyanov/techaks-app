type CacheEntry<T> = {
  expiresAt: number;
  value: T;
  generatedAt: string;
};

const homepageCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function getOrSetHomepageCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
) {
  const now = Date.now();
  const cached = homepageCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return {
      value: cached.value,
      meta: {
        cacheStatus: "hit" as const,
        generatedAt: cached.generatedAt,
        expiresAt: new Date(cached.expiresAt).toISOString(),
      },
    };
  }

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) {
    const value = await running;
    const postInflight = homepageCache.get(key) as CacheEntry<T> | undefined;
    return {
      value,
      meta: {
        cacheStatus: "shared" as const,
        generatedAt: postInflight?.generatedAt ?? new Date().toISOString(),
        expiresAt: postInflight
          ? new Date(postInflight.expiresAt).toISOString()
          : new Date(now + ttlMs).toISOString(),
      },
    };
  }

  const promise = loader();
  inflight.set(key, promise);

  try {
    const value = await promise;
    const generatedAt = new Date().toISOString();
    const expiresAt = Date.now() + ttlMs;
    homepageCache.set(key, {
      value,
      expiresAt,
      generatedAt,
    });
    return {
      value,
      meta: {
        cacheStatus: "miss" as const,
        generatedAt,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    };
  } finally {
    inflight.delete(key);
  }
}

export function clearHomepageCache(key?: string) {
  if (key) {
    homepageCache.delete(key);
    inflight.delete(key);
    return;
  }
  homepageCache.clear();
  inflight.clear();
}
