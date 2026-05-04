const fetchWithTimeout = async (url, options = {}, timeoutMs = 25000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const loadLearnWorldsApiSource = async () => {
  let response;

  try {
    response = await fetchWithTimeout('/api/learnworlds-published', {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'LearnWorlds published data request timed out while loading dashboard data.'
        : error?.message || 'Failed to reach the LearnWorlds published data route.';
    throw new Error(message);
  }

  const json = await response.json();
  const payload = json?.success === true ? json.data : json;

  if (json?.success === false) {
    throw new Error(json?.error || 'Failed to load LearnWorlds published data.');
  }

  if (!response.ok) {
    throw new Error(json?.error || 'Failed to load LearnWorlds published data.');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('LearnWorlds published data not found.');
  }

  if (!payload.datasets) {
    return null;
  }

  return payload;
};
