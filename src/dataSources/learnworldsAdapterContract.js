export const LEARNWORLDS_SOURCE_DATASET_KEYS = [
  'userRows',
  'enrollmentRows',
  'courseRows',
  'progressRows',
  'activityAnalyticsRows',
];

/**
 * Adapter contract for any future LearnWorlds source implementation.
 *
 * A LearnWorlds source adapter must return an object with:
 * - `adapterId`: stable adapter identifier, e.g. `learnworlds-api`
 * - `sourceKind`: transport type, e.g. `api`
 * - `datasets`: an object containing the raw row arrays required by the
 *   LearnWorlds ingestion/normalization pipeline
 * - `meta`: optional source-specific metadata
 *
 * LearnWorlds stays intentionally separate from the Intercom source contract.
 */
export const createLearnWorldsSourcePayload = ({
  adapterId,
  sourceKind,
  datasets,
  meta = {},
}) => {
  const normalizedDatasets = LEARNWORLDS_SOURCE_DATASET_KEYS.reduce((accumulator, key) => {
    const value = datasets[key];

    if (!Array.isArray(value)) {
      throw new Error(`LearnWorlds source adapter is missing dataset array: ${key}`);
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
