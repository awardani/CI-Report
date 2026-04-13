import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntercomDatasets } from '../src/metrics/normalization.js';
import { createFixtureDatasets } from './fixtures/intercomFixtures.js';

test('normalization builds conversations, ratings, and fin outcomes', () => {
  const normalized = normalizeIntercomDatasets(createFixtureDatasets());

  assert.equal(normalized.conversations.length, 3);
  assert.equal(normalized.ratings.length, 5);
  assert.equal(normalized.fin_outcomes.length, 2);

  assert.equal(normalized.conversations[0].conversation_id, 'conv-1');
  assert.equal(normalized.ratings[0].rating_source, 'satisfaction');
  assert.equal(normalized.ratings[0].rated_teammate_name, 'Ann');
  assert.equal(normalized.ratings[2].conversation_found, false);
  assert.equal(normalized.fin_outcomes[0].validation.has_deflection_detail, true);
});
