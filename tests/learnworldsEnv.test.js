import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNWORLDS_SERVER_ENV_KEYS,
  loadLearnWorldsServerEnv,
  maskLearnWorldsServerConfig,
  validateLearnWorldsServerEnv,
} from '../server/learnworlds/env.js';

test('LearnWorlds env loader reads provided values and masks them safely', () => {
  const config = loadLearnWorldsServerEnv({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
      LEARNWORLDS_API_TOKEN: 'learnworlds-secret',
      LEARNWORLDS_DATA_SOURCE: 'api',
      LEARNWORLDS_CLIENT_ID: 'client-id',
      LEARNWORLDS_CLIENT_SECRET: 'client-secret',
      LEARNWORLDS_INITIAL_PAGE_LIMIT: '7',
      LEARNWORLDS_REQUEST_DELAY_MS: '300',
      LEARNWORLDS_DATASET_CACHE_TTL_MS: '60000',
    },
  });

  const validation = validateLearnWorldsServerEnv(config);
  const masked = maskLearnWorldsServerConfig(config);

  assert.equal(validation.isValid, true);
  assert.equal(masked.dataSource, 'api');
  assert.equal(masked.apiBaseUrlHost, 'api.learnworlds.test');
  assert.equal(masked.apiKeyPresent, true);
  assert.equal(masked.clientIdPresent, true);
  assert.equal(masked.clientSecretPresent, true);
  assert.equal(masked.initialPageLimit, 7);
  assert.equal(masked.requestDelayMs, 300);
  assert.equal(masked.datasetCacheTtlMs, 60000);
});

test('LearnWorlds validation requires API credentials when api mode is enabled', () => {
  const config = loadLearnWorldsServerEnv({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_DATA_SOURCE: 'api',
    },
  });

  const validation = validateLearnWorldsServerEnv(config);

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.missing.sort(), [
    'LEARNWORLDS_API_BASE_URL',
    'LEARNWORLDS_API_KEY',
  ]);
});

test('LearnWorlds validation rejects unsupported data source values', () => {
  const config = loadLearnWorldsServerEnv({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_DATA_SOURCE: 'csv',
    },
  });

  const validation = validateLearnWorldsServerEnv(config);

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.invalid, ['LEARNWORLDS_DATA_SOURCE']);
});

test('LearnWorlds validation rejects invalid LearnWorlds fetch tuning values', () => {
  const config = loadLearnWorldsServerEnv({
    rootDir: '/tmp',
    env: {
      LEARNWORLDS_DATA_SOURCE: 'api',
      LEARNWORLDS_API_BASE_URL: 'https://api.learnworlds.test',
      LEARNWORLDS_API_KEY: 'secret',
      LEARNWORLDS_INITIAL_PAGE_LIMIT: '0',
      LEARNWORLDS_REQUEST_DELAY_MS: '-1',
      LEARNWORLDS_DATASET_CACHE_TTL_MS: 'abc',
    },
  });

  const validation = validateLearnWorldsServerEnv(config);

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.invalid.sort(), [
    'LEARNWORLDS_DATASET_CACHE_TTL_MS',
    'LEARNWORLDS_INITIAL_PAGE_LIMIT',
    'LEARNWORLDS_REQUEST_DELAY_MS',
  ]);
});

test('LearnWorlds env key export includes all supported variables', () => {
  assert.deepEqual(LEARNWORLDS_SERVER_ENV_KEYS, [
    'LEARNWORLDS_API_BASE_URL',
    'LEARNWORLDS_API_KEY',
    'LEARNWORLDS_API_TOKEN',
    'LEARNWORLDS_DATA_SOURCE',
    'LEARNWORLDS_CLIENT_ID',
    'LEARNWORLDS_CLIENT_SECRET',
    'LEARNWORLDS_INITIAL_PAGE_LIMIT',
    'LEARNWORLDS_REQUEST_DELAY_MS',
    'LEARNWORLDS_DATASET_CACHE_TTL_MS',
  ]);
});
