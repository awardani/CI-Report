import {
  normalizeLearnWorldsRequestMode,
  resolveLearnWorldsSource,
} from '../server/learnworlds/sourceResolver.js';

const sendJson = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const countItemsFetched = (payload) =>
  Object.values(payload?.datasets || {}).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, {
      success: false,
      data: null,
      error: 'Method not allowed.',
      meta: {
        source: 'learnworlds',
        status: 'method_not_allowed',
        itemsFetched: 0,
        error: 'Use GET for /api/learnworlds-datasets.',
        debugInfo: {
          method: req.method,
          route: '/api/learnworlds-datasets',
        },
      },
    });
  }

  try {
    const requestUrl = new URL(req.url || '/api/learnworlds-datasets', 'http://localhost');
    const mode = normalizeLearnWorldsRequestMode(requestUrl.searchParams.get('mode'));
    const payload = await resolveLearnWorldsSource({ requestMode: mode });
    return sendJson(res, 200, {
      success: true,
      data: payload,
      meta: {
        source: 'learnworlds',
        status: 'ok',
        itemsFetched: countItemsFetched(payload),
        error: null,
        debugInfo: {
          adapterId: payload?.adapterId || null,
          sourceKind: payload?.sourceKind || null,
          loadMode: payload?.meta?.loadMode || mode,
          snapshot: payload?.meta?.snapshot || null,
          rowCounts: payload?.meta?.rowCounts || null,
          warnings: payload?.meta?.warnings || [],
          cache: payload?.meta?.cache || null,
        },
      },
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      data: null,
      error: error?.message || 'Failed to load LearnWorlds API datasets.',
      meta: {
        source: 'learnworlds',
        status: 'error',
        itemsFetched: 0,
        error: error?.message || 'Failed to load LearnWorlds API datasets.',
        debugInfo: {
          route: '/api/learnworlds-datasets',
        },
      },
    });
  }
}
