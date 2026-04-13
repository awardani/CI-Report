import { readLocalEnvFiles } from '../shared/envFiles.js';

const ENV_KEYS = [
  'INTERCOM_CLIENT_ID',
  'INTERCOM_CLIENT_SECRET',
  'INTERCOM_ACCESS_TOKEN',
  'INTERCOM_API_BASE_URL',
];

export const loadIntercomServerEnv = ({ rootDir = process.cwd(), env = process.env } = {}) => {
  const localEnv = readLocalEnvFiles(rootDir);
  const merged = { ...localEnv, ...env };

  return {
    clientId: merged.INTERCOM_CLIENT_ID || '',
    clientSecret: merged.INTERCOM_CLIENT_SECRET || '',
    accessToken: merged.INTERCOM_ACCESS_TOKEN || '',
    apiBaseUrl: merged.INTERCOM_API_BASE_URL || 'https://api.intercom.io',
    initialBackfillDays: Number.parseInt(merged.INTERCOM_INITIAL_BACKFILL_DAYS || '120', 10),
    lookupCacheTtlMs: Number.parseInt(merged.INTERCOM_LOOKUP_CACHE_TTL_MS || `${6 * 60 * 60 * 1000}`, 10),
    datasetCacheTtlMs: Number.parseInt(merged.INTERCOM_DATASET_CACHE_TTL_MS || `${5 * 60 * 1000}`, 10),
  };
};

export const validateIntercomServerEnv = (config) => {
  const missing = [];

  if (!config.accessToken) {
    missing.push('INTERCOM_ACCESS_TOKEN');
  }

  return {
    isValid: missing.length === 0,
    missing,
  };
};

export const maskIntercomServerConfig = (config) => ({
  clientIdPresent: Boolean(config.clientId),
  clientSecretPresent: Boolean(config.clientSecret),
  accessTokenPresent: Boolean(config.accessToken),
  initialBackfillDays: Number.isFinite(config.initialBackfillDays) ? config.initialBackfillDays : null,
  apiBaseUrlHost: (() => {
    try {
      return new URL(config.apiBaseUrl).host;
    } catch {
      return 'invalid-url';
    }
  })(),
});

export const INTERCOM_SERVER_ENV_KEYS = ENV_KEYS;
