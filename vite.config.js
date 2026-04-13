import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createIntercomApiHttpHandler } from './server/intercom/apiAdapter.js'
import { createLearnWorldsApiHttpHandler } from './server/learnworlds/apiAdapter.js'

const intercomApiDevPlugin = (env) => {
  const handler = createIntercomApiHttpHandler({ env });

  return {
    name: 'intercom-api-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/intercom-datasets', async (_req, res) => {
        try {
          const payload = await handler();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Failed to load Intercom API datasets.',
              detail: error.message,
            })
          );
        }
      });
    },
  };
}

const learnWorldsApiDevPlugin = (env) => {
  const handler = createLearnWorldsApiHttpHandler({ env });

  return {
    name: 'learnworlds-api-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/learnworlds-datasets', async (_req, res) => {
        try {
          const payload = await handler();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(payload));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Failed to load LearnWorlds API datasets.',
              detail: error.message,
            })
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), intercomApiDevPlugin(env), learnWorldsApiDevPlugin(env)],
  }
})
