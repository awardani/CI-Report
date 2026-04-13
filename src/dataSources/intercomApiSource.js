export const loadIntercomApiSource = async () => {
  const response = await fetch('/api/intercom-datasets', {
    headers: {
      Accept: 'application/json',
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.detail || body?.error || 'Failed to load Intercom API datasets.');
  }

  return body;
};
