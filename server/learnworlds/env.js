import { readLocalEnvFiles } from '../shared/envFiles.js';

const ENV_KEYS = [
  'LEARNWORLDS_API_BASE_URL',
  'LEARNWORLDS_API_KEY',
  'LEARNWORLDS_API_TOKEN',
  'LEARNWORLDS_DATA_SOURCE',
  'LEARNWORLDS_CLIENT_ID',
  'LEARNWORLDS_CLIENT_SECRET',
  'LEARNWORLDS_INITIAL_PAGE_LIMIT',
  'LEARNWORLDS_REQUEST_DELAY_MS',
  'LEARNWORLDS_DATASET_CACHE_TTL_MS',
];

const VALID_DATA_SOURCES = new Set(['', 'api']);
const DEFAULT_INITIAL_PAGE_LIMIT = 5;
const DEFAULT_REQUEST_DELAY_MS = 250;
const DEFAULT_DATASET_CACHE_TTL_MS = 5 * 60 * 1000;

const parseIntegerEnv = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) ? normalized : Number.NaN;
};

export const loadLearnWorldsServerEnv = ({ rootDir = process.cwd(), env = process.env } = {}) => {
  const localEnv = readLocalEnvFiles(rootDir);
  const merged = { ...localEnv, ...env };

  return {
    apiBaseUrl: merged.LEARNWORLDS_API_BASE_URL || '',
    apiKey: merged.LEARNWORLDS_API_KEY || merged.LEARNWORLDS_API_TOKEN || '',
    dataSource: merged.LEARNWORLDS_DATA_SOURCE || '',
    clientId: merged.LEARNWORLDS_CLIENT_ID || '',
    clientSecret: merged.LEARNWORLDS_CLIENT_SECRET || '',
    initialPageLimit: parseIntegerEnv(
      merged.LEARNWORLDS_INITIAL_PAGE_LIMIT,
      DEFAULT_INITIAL_PAGE_LIMIT
    ),
    requestDelayMs: parseIntegerEnv(
      merged.LEARNWORLDS_REQUEST_DELAY_MS,
      DEFAULT_REQUEST_DELAY_MS
    ),
    datasetCacheTtlMs: parseIntegerEnv(
      merged.LEARNWORLDS_DATASET_CACHE_TTL_MS,
      DEFAULT_DATASET_CACHE_TTL_MS
    ),
  };
};

export const validateLearnWorldsServerEnv = (config) => {
  const missing = [];
  const invalid = [];

  if (!VALID_DATA_SOURCES.has(config.dataSource)) {
    invalid.push('LEARNWORLDS_DATA_SOURCE');
  }

  if (!Number.isInteger(config.initialPageLimit) || config.initialPageLimit < 1) {
    invalid.push('LEARNWORLDS_INITIAL_PAGE_LIMIT');
  }

  if (!Number.isInteger(config.requestDelayMs) || config.requestDelayMs < 0) {
    invalid.push('LEARNWORLDS_REQUEST_DELAY_MS');
  }

  if (!Number.isInteger(config.datasetCacheTtlMs) || config.datasetCacheTtlMs < 0) {
    invalid.push('LEARNWORLDS_DATASET_CACHE_TTL_MS');
  }

  if (config.dataSource === 'api') {
    if (!config.apiBaseUrl) {
      missing.push('LEARNWORLDS_API_BASE_URL');
    }

    if (!config.apiKey) {
      missing.push('LEARNWORLDS_API_KEY');
    }
  }

  return {
    isValid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
};

export const maskLearnWorldsServerConfig = (config) => ({
  dataSource: config.dataSource || '',
  apiBaseUrlHost: (() => {
    try {
      return config.apiBaseUrl ? new URL(config.apiBaseUrl).host : '';
    } catch {
      return 'invalid-url';
    }
  })(),
  apiKeyPresent: Boolean(config.apiKey),
  clientIdPresent: Boolean(config.clientId),
  clientSecretPresent: Boolean(config.clientSecret),
  initialPageLimit: config.initialPageLimit,
  requestDelayMs: config.requestDelayMs,
  datasetCacheTtlMs: config.datasetCacheTtlMs,
});

export const LEARNWORLDS_SERVER_ENV_KEYS = ENV_KEYS;
