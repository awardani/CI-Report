const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
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

export const loadIntercomApiSource = async () => {
  let response;

  try {
    response = await fetchWithTimeout('/api/intercom-datasets', {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message =
      error?.name === 'AbortError'
        ? 'Intercom API request timed out while loading dashboard data.'
        : error?.message || 'Failed to reach the Intercom API route.';
    throw new Error(message);
  }

  const json = await response.json();
  const payload = json?.success === true ? json.data : json;

  if (json?.success === false) {
    throw new Error(json?.error || 'Failed to load Intercom API datasets.');
  }

  if (!response.ok) {
    throw new Error(json?.error || 'Failed to load Intercom API datasets.');
  }

  if (!payload || !payload.datasets) {
    throw new Error('Intercom datasets not found.');
  }

  return payload;
};
