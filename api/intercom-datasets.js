import { createIntercomApiHttpHandler } from '../server/intercom/apiAdapter.js';

const handlerImpl = createIntercomApiHttpHandler();

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
        source: 'intercom',
        status: 'method_not_allowed',
        itemsFetched: 0,
        error: 'Use GET for /api/intercom-datasets.',
        debugInfo: {
          method: req.method,
          route: '/api/intercom-datasets',
        },
      },
    });
  }

  try {
    const payload = await handlerImpl();
    return sendJson(res, 200, {
      success: true,
      data: payload,
      meta: {
        source: 'intercom',
        status: 'ok',
        itemsFetched: countItemsFetched(payload),
        error: null,
        debugInfo: {
          adapterId: payload?.adapterId || null,
          sourceKind: payload?.sourceKind || null,
          apiSummary: payload?.meta?.apiSummary || null,
          warnings: payload?.meta?.warnings || [],
        },
      },
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      data: null,
      error: error?.message || 'Failed to load Intercom API datasets.',
      meta: {
        source: 'intercom',
        status: 'error',
        itemsFetched: 0,
        error: error?.message || 'Failed to load Intercom API datasets.',
        debugInfo: {
          route: '/api/intercom-datasets',
        },
      },
    });
  }
}
