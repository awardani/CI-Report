import fs from 'node:fs';
import path from 'node:path';
import { getLearnWorldsPublishedPath } from './publishedStore.js';

const rootDir = process.cwd();
const publishedPath = getLearnWorldsPublishedPath({ rootDir });
const tempPath = `${publishedPath}.tmp`;
const syncUrl =
  process.env.LEARNWORLDS_SYNC_URL ||
  'http://127.0.0.1:5173/api/learnworlds-datasets?mode=full';

const validatePayload = (json) => {
  if (json?.success !== true) {
    throw new Error(json?.error || 'LearnWorlds sync route did not return success=true.');
  }

  if (!json.data) {
    throw new Error('LearnWorlds sync route returned no data payload.');
  }

  if (!json.data.datasets) {
    throw new Error('LearnWorlds sync route returned data without datasets.');
  }
};

const run = async () => {
  console.info('Sync started');

  try {
    const response = await fetch(syncUrl, {
      headers: {
        Accept: 'application/json',
      },
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json?.error || `LearnWorlds sync route returned HTTP ${response.status}.`);
    }

    validatePayload(json);
    console.info('Validation passed');

    fs.mkdirSync(path.dirname(publishedPath), { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(json.data, null, 2));
    fs.renameSync(tempPath, publishedPath);

    console.info('Published successfully');
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { force: true });
    }

    console.error('Validation failed');
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  }
};

run();
