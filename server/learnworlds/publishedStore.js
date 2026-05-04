import fs from 'node:fs';
import path from 'node:path';

const PUBLISHED_DIR_SEGMENTS = ['server', 'learnworlds', 'data'];
const CURRENT_FILENAME = 'current.json';

export const getLearnWorldsPublishedPath = ({ rootDir = process.cwd() } = {}) =>
  path.join(rootDir, ...PUBLISHED_DIR_SEGMENTS, CURRENT_FILENAME);

export const readLearnWorldsPublishedData = ({ rootDir = process.cwd() } = {}) => {
  const publishedPath = getLearnWorldsPublishedPath({ rootDir });

  if (!fs.existsSync(publishedPath)) {
    throw new Error('LearnWorlds published data file not found.');
  }

  return JSON.parse(fs.readFileSync(publishedPath, 'utf8'));
};
