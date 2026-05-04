import { loadLearnWorldsApiSource } from './apiAdapter.js';
import {
  getLearnWorldsSnapshotPaths,
  writeLearnWorldsSnapshot,
} from './snapshotStore.js';

const rootDir = process.cwd();

const syncEnv = {
  ...process.env,
  LEARNWORLDS_INITIAL_PAGE_LIMIT:
    process.env.LEARNWORLDS_SYNC_INITIAL_PAGE_LIMIT ||
    process.env.LEARNWORLDS_INITIAL_PAGE_LIMIT ||
    '12',
  LEARNWORLDS_REQUEST_DELAY_MS:
    process.env.LEARNWORLDS_SYNC_REQUEST_DELAY_MS ||
    process.env.LEARNWORLDS_REQUEST_DELAY_MS ||
    '500',
  LEARNWORLDS_REQUEST_TIMEOUT_MS:
    process.env.LEARNWORLDS_SYNC_REQUEST_TIMEOUT_MS ||
    process.env.LEARNWORLDS_REQUEST_TIMEOUT_MS ||
    '30000',
};

const summarizeCounts = (payload) =>
  Object.fromEntries(
    Object.entries(payload?.datasets || {}).map(([key, rows]) => [key, Array.isArray(rows) ? rows.length : 0])
  );

const run = async () => {
  console.info('[LearnWorlds Sync] Starting daily snapshot sync.');

  const livePayload = await loadLearnWorldsApiSource({
    rootDir,
    env: syncEnv,
    loadMode: 'full',
  });

  const snapshotPayload = writeLearnWorldsSnapshot({
    rootDir,
    payload: livePayload,
    trigger: 'daily-sync-script',
  });

  const { latestPath, previousPath } = getLearnWorldsSnapshotPaths({ rootDir });

  console.info('[LearnWorlds Sync] Snapshot updated successfully.');
  console.info(`[LearnWorlds Sync] Latest snapshot: ${latestPath}`);
  console.info(`[LearnWorlds Sync] Previous snapshot: ${previousPath}`);
  console.info(
    `[LearnWorlds Sync] Dataset counts ${JSON.stringify(summarizeCounts(snapshotPayload))}`
  );
};

run().catch((error) => {
  console.error('[LearnWorlds Sync] Snapshot sync failed.');
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
