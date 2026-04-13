export const loadLearnWorldsApiSource = async () => {
  const response = await fetch('/api/learnworlds-datasets', {
    headers: {
      Accept: 'application/json',
    },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.detail || body?.error || 'Failed to load LearnWorlds API datasets.');
  }

  return body;
};
