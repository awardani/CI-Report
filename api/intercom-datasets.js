import { createIntercomApiHttpHandler } from '../server/intercom/apiAdapter.js';

const handlerImpl = createIntercomApiHttpHandler();

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
      detail: 'Use GET for /api/intercom-datasets.',
    });
  }

  try {
    const payload = await handlerImpl();
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 500, {
      error: 'Failed to load Intercom API datasets.',
      detail: error.message,
    });
  }
}
