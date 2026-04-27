import { createLearnWorldsApiHttpHandler } from '../server/learnworlds/apiAdapter.js';

const handlerImpl = createLearnWorldsApiHttpHandler();

const sendJson = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, {
      error: 'Method not allowed.',
      detail: 'Use GET for /api/learnworlds-datasets.',
    });
  }

  try {
    const payload = await handlerImpl();
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 500, {
      error: 'Failed to load LearnWorlds API datasets.',
      detail: error.message,
    });
  }
}
