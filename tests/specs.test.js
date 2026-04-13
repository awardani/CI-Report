import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntercomDatasets } from '../src/metrics/normalization.js';
import { calculateMetricSet } from '../src/metrics/specs.js';
import { createFixtureDatasets } from './fixtures/intercomFixtures.js';

test('metric specs calculate expected values from normalized datasets', () => {
  const normalized = normalizeIntercomDatasets(createFixtureDatasets());
  const metrics = calculateMetricSet(normalized, {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    team: '',
    teammate: '',
  });

  assert.equal(metrics.new_conversations.numerator, 2);
  assert.equal(metrics.new_conversations.supportLevel, 'partial');

  assert.equal(metrics.overall_csat.numerator, 2);
  assert.equal(metrics.overall_csat.denominator, 3);

  assert.equal(metrics.teammate_csat.numerator, 1);
  assert.equal(metrics.teammate_csat.denominator, 2);

  assert.equal(metrics.fin_csat.numerator, 1);
  assert.equal(metrics.fin_csat.denominator, 2);

  assert.equal(metrics.fin_deflection_rate.numerator, 1);
  assert.equal(metrics.fin_deflection_rate.denominator, 2);
  assert.equal(metrics.fin_deflection_rate.supportLevel, 'full');

  assert.equal(metrics.fin_resolution_rate.numerator, 1);
  assert.equal(metrics.fin_resolution_rate.denominator, 2);
});

test('team filter uses joined conversation metadata for CSAT metrics', () => {
  const normalized = normalizeIntercomDatasets(createFixtureDatasets());
  const metrics = calculateMetricSet(normalized, {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    team: 'Alpha',
    teammate: '',
  });

  assert.equal(metrics.overall_csat.denominator, 2);
  assert.equal(metrics.overall_csat.numerator, 2);
  assert.equal(metrics.fin_csat.denominator, 1);
  assert.equal(metrics.fin_csat.numerator, 1);
});
