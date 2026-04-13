import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntercomDatasets } from '../src/metrics/normalization.js';
import { validateIntercomData } from '../src/metrics/validation.js';
import { createFixtureDatasets } from './fixtures/intercomFixtures.js';

test('validation reports unmatched joins and metadata gaps', () => {
  const datasets = createFixtureDatasets();
  const normalized = normalizeIntercomDatasets(datasets);
  const report = validateIntercomData(datasets, normalized);

  assert.equal(report.normalizedSummary.joinStats.unmatchedRatings, 2);
  assert.equal(report.normalizedSummary.metadataStats.ratingsMissingTeamMetadata, 2);
  assert.equal(report.normalizedSummary.metadataStats.teammateRatingsMissingRatedTeammateMetadata, 1);
  assert.ok(
    report.warnings.some((warning) => warning.includes('rating rows could not be matched'))
  );
});

test('validation catches missing columns and invalid source values', () => {
  const datasets = createFixtureDatasets();
  datasets.satisfactionRows = [
    {
      'Conversation ID': 'conv-bad',
      'Updated at (America/New_York)': 'invalid-date',
      'Conversation rating': '9',
      'Last survey sent': '123',
      'Unexpected column': 'boom',
    },
  ];
  datasets.finResolutionRows = [
    {
      'Conversation ID': 'conv-fin',
      'Conversation started at (America/New_York)': '',
      'Fin AI Agent resolution state': 'Mystery state',
      'Fin AI Agent rating': '7',
      'AI Subtopic': '',
      'AI Topic': '',
    },
  ];
  datasets.finSatisfactionRows = [
    {
      'Conversation ID': 'conv-fin',
      'Updated at (America/New_York)': '',
      'Conversation rating remark': '',
      'Conversation rating': '0',
      'User name': '',
      'Company name': '',
      'Last survey sent': '',
      'Fin AI Agent involved': 'sometimes',
    },
  ];

  const normalized = normalizeIntercomDatasets(datasets);
  const report = validateIntercomData(datasets, normalized);
  const sourceReport = report.sourceValidations.satisfactionRows;
  const finSatisfactionReport = report.sourceValidations.finSatisfactionRows;
  const finResolutionReport = report.sourceValidations.finResolutionRows;

  assert.ok(sourceReport.missingRequiredColumns.includes('Agent rated type'));
  assert.ok(sourceReport.unexpectedColumns.includes('Unexpected column'));
  assert.equal(sourceReport.timestampIssues[0].invalid, 1);
  assert.equal(sourceReport.invalidRatingCounts[0].invalidCount, 1);
  assert.equal(finSatisfactionReport.timestampIssues[0].empty, 1);
  assert.equal(finSatisfactionReport.invalidRatingCounts[0].invalidCount, 1);
  assert.equal(finSatisfactionReport.invalidBooleanCounts[0].invalidCount, 1);
  assert.equal(finResolutionReport.timestampIssues[0].empty, 1);
  assert.equal(finResolutionReport.invalidRatingCounts[0].invalidCount, 1);
  assert.equal(finResolutionReport.invalidFinResolutionCounts[0].invalidCount, 1);
});
