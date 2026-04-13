export const INTERCOM_SOURCE_DATASET_KEYS = [
  'conversationRows',
  'satisfactionRows',
  'finSatisfactionRows',
  'finDeflectionRows',
  'finResolutionRows',
];

/**
 * Adapter contract for any future Intercom source implementation.
 *
 * A source adapter must return an object with:
 * - `adapterId`: stable adapter identifier, e.g. `intercom-csv` or `intercom-api`
 * - `sourceKind`: transport type, e.g. `csv` or `api`
 * - `datasets`: an object containing the raw row arrays required by the
 *   normalization layer
 * - `meta`: optional source-specific metadata
 *
 * The normalization, metric, and UI layers should depend only on this
 * contract, not on adapter-specific loading details.
 */
export const createIntercomSourcePayload = ({
  adapterId,
  sourceKind,
  datasets,
  meta = {},
}) => {
  const normalizedDatasets = INTERCOM_SOURCE_DATASET_KEYS.reduce((accumulator, key) => {
    const value = datasets[key];

    if (!Array.isArray(value)) {
      throw new Error(`Intercom source adapter is missing dataset array: ${key}`);
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

  return {
    adapterId,
    sourceKind,
    datasets: normalizedDatasets,
    meta,
  };
};
