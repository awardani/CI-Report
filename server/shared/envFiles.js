import fs from 'node:fs';
import path from 'node:path';

const parseDotEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, 'utf8');

  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf('=');
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');

      accumulator[key] = value;
      return accumulator;
    }, {});
};

export const readLocalEnvFiles = (rootDir) => ({
  ...parseDotEnvFile(path.join(rootDir, '.env')),
  ...parseDotEnvFile(path.join(rootDir, '.env.local')),
});
