import { loadIntercomApiSource } from './intercomApiSource.js';
import { loadIntercomCsvSource } from './intercomCsvSource.js';
import { loadLearnWorldsApiSource } from './learnworldsApiSource.js';

const getConfiguredIntercomMode = () => {
  const configured = import.meta.env.VITE_INTERCOM_DATA_SOURCE;
  return configured === 'csv' ? 'csv' : 'api';
};

const getConfiguredLearnWorldsMode = () => {
  const configured = import.meta.env.VITE_LEARNWORLDS_DATA_SOURCE;
  if (configured === 'snapshot') {
    return 'snapshot';
  }
  if (configured === 'api') {
    return 'api';
  }
  return configured === 'disabled' ? 'disabled' : 'api';
};

export const loadConfiguredIntercomSource = async () => {
  const mode = getConfiguredIntercomMode();

  if (mode === 'csv') {
    return loadIntercomCsvSource();
  }

  try {
    return await loadIntercomApiSource();
  } catch (error) {
    console.warn(
      'Intercom API source failed, falling back to CSV data for local reliability.',
      error
    );
    return loadIntercomCsvSource();
  }
};

export const loadConfiguredLearnWorldsSource = async (options) => {
  const mode = getConfiguredLearnWorldsMode();

  if (mode === 'disabled') {
    return null;
  }

  if (mode === 'snapshot') {
    return loadLearnWorldsApiSource({ mode: 'snapshot' });
  }

  return loadLearnWorldsApiSource(options);
};

export {
  loadIntercomApiSource,
  loadIntercomCsvSource,
  loadLearnWorldsApiSource,
};
