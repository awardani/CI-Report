import { loadLearnWorldsApiSource } from './apiAdapter.js';
import { readLearnWorldsSnapshot } from './snapshotStore.js';

export const normalizeLearnWorldsRequestMode = (value) => {
  if (value === 'overview') {
    return 'overview';
  }

  if (value === 'full' || value === 'live') {
    return 'full';
  }

  return 'snapshot';
};

export const resolveLearnWorldsSource = async ({
  requestMode = 'snapshot',
  rootDir = process.cwd(),
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const normalizedMode = normalizeLearnWorldsRequestMode(requestMode);

  if (normalizedMode === 'snapshot') {
    try {
      return readLearnWorldsSnapshot({ rootDir });
    } catch (snapshotError) {
      const liveFallback = await loadLearnWorldsApiSource({
        rootDir,
        env,
        fetchImpl,
        loadMode: 'overview',
      });

      return {
        ...liveFallback,
        meta: {
          ...(liveFallback.meta || {}),
          loadMode: 'overview',
          snapshot: {
            available: false,
            fallbackReason: snapshotError?.message || 'LearnWorlds snapshot unavailable.',
          },
          warnings: [
            ...(liveFallback.meta?.warnings || []),
            `LearnWorlds snapshot unavailable: ${snapshotError?.message || 'Unknown reason.'}`,
          ],
        },
      };
    }
  }

  return loadLearnWorldsApiSource({
    rootDir,
    env,
    fetchImpl,
    loadMode: normalizedMode,
  });
};
