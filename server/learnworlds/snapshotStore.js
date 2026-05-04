import fs from 'node:fs';
import path from 'node:path';
import { createLearnWorldsSourcePayload } from '../../src/dataSources/learnworldsAdapterContract.js';

const SNAPSHOT_DIR_SEGMENTS = ['server', 'data', 'learnworlds'];
const LATEST_FILENAME = 'latest.json';
const PREVIOUS_FILENAME = 'previous.json';

const getSnapshotDir = (rootDir) => path.join(rootDir, ...SNAPSHOT_DIR_SEGMENTS);

export const getLearnWorldsSnapshotPaths = ({ rootDir = process.cwd() } = {}) => {
  const snapshotDir = getSnapshotDir(rootDir);

  return {
    snapshotDir,
    latestPath: path.join(snapshotDir, LATEST_FILENAME),
    previousPath: path.join(snapshotDir, PREVIOUS_FILENAME),
  };
};

const ensureSnapshotDir = ({ rootDir = process.cwd() } = {}) => {
  const { snapshotDir } = getLearnWorldsSnapshotPaths({ rootDir });
  fs.mkdirSync(snapshotDir, { recursive: true });
  return snapshotDir;
};

const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const toSnapshotSourcePayload = ({ storedRecord, latestPath }) =>
  createLearnWorldsSourcePayload({
    adapterId: 'learnworlds-snapshot',
    sourceKind: 'snapshot',
    datasets: storedRecord.payload.datasets,
    meta: {
      ...(storedRecord.payload.meta || {}),
      loadMode: 'snapshot',
      snapshot: {
        syncedAt: storedRecord.syncedAt || storedRecord.storedAt || null,
        storedAt: storedRecord.storedAt || null,
        trigger: storedRecord.trigger || 'unknown',
        upstreamAdapterId: storedRecord.payload.adapterId || null,
        upstreamSourceKind: storedRecord.payload.sourceKind || null,
        filePath: latestPath,
      },
      cache: {
        ...(storedRecord.payload.meta?.cache || {}),
        snapshotHit: true,
      },
    },
  });

export const readLearnWorldsSnapshot = ({ rootDir = process.cwd() } = {}) => {
  const { latestPath } = getLearnWorldsSnapshotPaths({ rootDir });

  if (!fs.existsSync(latestPath)) {
    throw new Error('LearnWorlds snapshot not found.');
  }

  const storedRecord = readJsonFile(latestPath);

  if (!storedRecord?.payload?.datasets) {
    throw new Error('LearnWorlds snapshot payload is invalid.');
  }

  return toSnapshotSourcePayload({
    storedRecord,
    latestPath,
  });
};

export const writeLearnWorldsSnapshot = ({
  rootDir = process.cwd(),
  payload,
  trigger = 'manual',
} = {}) => {
  if (!payload?.datasets) {
    throw new Error('LearnWorlds snapshot write requires a source payload with datasets.');
  }

  const { latestPath, previousPath } = getLearnWorldsSnapshotPaths({ rootDir });
  ensureSnapshotDir({ rootDir });

  const now = new Date().toISOString();
  const tempPath = `${latestPath}.tmp`;
  const storedRecord = {
    storedAt: now,
    syncedAt: now,
    trigger,
    payload,
  };

  if (fs.existsSync(latestPath)) {
    fs.copyFileSync(latestPath, previousPath);
  }

  fs.writeFileSync(tempPath, JSON.stringify(storedRecord, null, 2));
  fs.renameSync(tempPath, latestPath);

  return toSnapshotSourcePayload({
    storedRecord,
    latestPath,
  });
};
