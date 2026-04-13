import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMetricFilters } from '../src/metrics/filtering.js';
import { normalizeIntercomDatasets } from '../src/metrics/normalization.js';
import { createFixtureDatasets } from './fixtures/intercomFixtures.js';

test('filter engine excludes unmatched rating rows when team filter is active', () => {
  const normalized = normalizeIntercomDatasets(createFixtureDatasets());
  const result = applyMetricFilters(normalized.ratings, {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    team: 'Alpha',
    teammate: '',
  }, {
    timestampField: 'rated_at',
    teamField: 'team_name',
    teammateFields: ['teammate_name'],
  });

  assert.equal(result.items.length, 3);
  assert.equal(result.metadata.missing_team_metadata_count, 2);
});

test('filter engine counts missing rated teammate metadata when teammate filter is active', () => {
  const normalized = normalizeIntercomDatasets(createFixtureDatasets());
  const teammateOnly = normalized.ratings.filter((rating) => rating.rated_agent_type === 'Teammate');

  const result = applyMetricFilters(teammateOnly, {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    team: '',
    teammate: 'Ann',
  }, {
    timestampField: 'rated_at',
    teamField: 'team_name',
    teammateFields: ['rated_teammate_name', 'teammate_name'],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.metadata.missing_teammate_metadata_count, 1);
});
