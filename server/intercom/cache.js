const memoryCache = new Map();

const isFresh = (entry) => entry && entry.expiresAt > Date.now();

export const getCachedValue = (key) => {
  const entry = memoryCache.get(key);

  if (!isFresh(entry)) {
    if (entry) {
      memoryCache.delete(key);
    }
    return null;
  }

  return entry.value;
};

export const readThroughCache = async ({ key, ttlMs, loader }) => {
  const existing = memoryCache.get(key);

  if (isFresh(existing) && existing.value !== undefined) {
    return { value: existing.value, cacheHit: true };
  }

  if (existing?.inFlightPromise) {
    return { value: await existing.inFlightPromise, cacheHit: true };
  }

  const inFlightPromise = loader().then((value) => {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  });

  memoryCache.set(key, {
    inFlightPromise,
    expiresAt: Date.now() + ttlMs,
  });

  const value = await inFlightPromise;
  return { value, cacheHit: false };
};

export const clearCache = () => {
  memoryCache.clear();
};
