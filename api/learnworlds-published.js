import { readLearnWorldsPublishedData } from '../server/learnworlds/publishedStore.js';

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
      success: false,
      data: null,
      error: 'Method not allowed.',
    });
  }

  try {
    const data = readLearnWorldsPublishedData();
    return sendJson(res, 200, {
      success: true,
      data,
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      data: null,
      error: error?.message || 'Failed to read LearnWorlds published data.',
    });
  }
}
