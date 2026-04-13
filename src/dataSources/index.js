import { loadIntercomCsvSource } from './intercomCsvSource.js';
import { loadIntercomApiSource } from './intercomApiSource.js';
import { loadLearnWorldsApiSource } from './learnworldsApiSource.js';

export const getConfiguredDataSourceMode = () => {
  const mode = (import.meta.env.VITE_DATA_SOURCE || 'csv').toLowerCase();
  return mode === 'api' ? 'api' : 'csv';
};

export const loadConfiguredIntercomSource = async () => {
  const mode = getConfiguredDataSourceMode();

  if (mode === 'api') {
    return loadIntercomApiSource();
  }

  return loadIntercomCsvSource();
};

export const loadConfiguredLearnWorldsSource = async () => loadLearnWorldsApiSource();
