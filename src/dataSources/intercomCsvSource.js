import Papa from 'papaparse';
import { createIntercomSourcePayload } from './adapterContract.js';

export const INTERCOM_CSV_FILES = {
  conversations: '/data.csv',
  satisfaction: '/csat.csv',
  finSatisfaction: '/fin_csat.csv',
  finDeflection: '/fin_deflection.csv',
  finResolution: '/fin_resolution.csv',
};

const parseCsvInput = (fileOrUrl) =>
  new Promise((resolve, reject) => {
    Papa.parse(fileOrUrl, {
      download: typeof fileOrUrl === 'string',
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });

export const loadIntercomCsvSource = async (files = INTERCOM_CSV_FILES) => {
  const [
    conversationRows,
    satisfactionRows,
    finSatisfactionRows,
    finDeflectionRows,
    finResolutionRows,
  ] = await Promise.all([
    parseCsvInput(files.conversations),
    parseCsvInput(files.satisfaction),
    parseCsvInput(files.finSatisfaction),
    parseCsvInput(files.finDeflection),
    parseCsvInput(files.finResolution),
  ]);

  return createIntercomSourcePayload({
    adapterId: 'intercom-csv',
    sourceKind: 'csv',
    datasets: {
      conversationRows,
      satisfactionRows,
      finSatisfactionRows,
      finDeflectionRows,
      finResolutionRows,
    },
    meta: { files },
  });
};
