import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { loadIntercomApiSource } from './server/intercom/apiAdapter.js';
import { readLearnWorldsPublishedData } from './server/learnworlds/publishedStore.js';
import {
  normalizeLearnWorldsRequestMode,
  resolveLearnWorldsSource,
} from './server/learnworlds/sourceResolver.js';

const countItemsFetched = (payload) =>
  Object.values(payload?.datasets || {}).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );

const sendJson = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const intercomApiDevPlugin = (env) => ({
  name: 'intercom-api-dev-endpoint',
  configureServer(server) {
    server.middlewares.use('/api/intercom-datasets', async (_req, res) => {
      try {
        const payload = await loadIntercomApiSource({ env });
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
    });
  },
});

const learnWorldsPublishedDevPlugin = () => ({
  name: 'learnworlds-published-dev-endpoint',
  configureServer(server) {
    server.middlewares.use('/api/learnworlds-published', (_req, res) => {
      try {
        return sendJson(res, 200, {
          success: true,
          data: readLearnWorldsPublishedData(),
        });
      } catch (error) {
        return sendJson(res, 500, {
          success: false,
          data: null,
          error: error?.message || 'Failed to read LearnWorlds published data.',
        });
      }
    });
  },
});

const learnWorldsApiDevPlugin = (env) => ({
  name: 'learnworlds-api-dev-endpoint',
  configureServer(server) {
    server.middlewares.use('/api/learnworlds-datasets', async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '/api/learnworlds-datasets', 'http://localhost');
        const mode = normalizeLearnWorldsRequestMode(requestUrl.searchParams.get('mode'));
        const payload = await resolveLearnWorldsSource({ env, requestMode: mode });

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
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
      },
    },
    plugins: [
      react(),
      intercomApiDevPlugin(env),
      learnWorldsPublishedDevPlugin(),
      learnWorldsApiDevPlugin(env),
    ],
  };
});
