import {
  normalizeLearnWorldsRequestMode,
  resolveLearnWorldsSource,
} from '../../server/learnworlds/sourceResolver.js';

export const handler = async () => {
  try {
    const mode = normalizeLearnWorldsRequestMode('snapshot');
    const payload = await resolveLearnWorldsSource({ requestMode: mode });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        success: true,
        data: payload,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to load LearnWorlds API datasets.',
        detail: error.message,
      }),
    };
  }
};
