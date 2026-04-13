import { createLearnWorldsApiHttpHandler } from '../../server/learnworlds/apiAdapter.js';

const handlerImpl = createLearnWorldsApiHttpHandler();

export const handler = async () => {
  try {
    const payload = await handlerImpl();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        error: 'Failed to load LearnWorlds API datasets.',
        detail: error.message,
      }),
    };
  }
};
