import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { calculateLearnWorldsMetricSet } from '../src/learnworlds/specs.js';
import { createLearnWorldsFixtureDatasets } from './fixtures/learnworldsFixtures.js';

test('LearnWorlds metric specs calculate current registration, engagement, and dropout metrics with explicit support states', () => {
  const normalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());
  const metrics = calculateLearnWorldsMetricSet(normalized, {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });

  assert.equal(metrics.lw_new_registrations.value, 2);
  assert.equal(metrics.lw_new_registrations.supportState, 'full');
  assert.equal(metrics.lw_new_registrations.timestampRule, 'created_at');

  assert.equal(metrics.lw_most_popular_courses.supportState, 'partial');
  assert.equal(metrics.lw_most_popular_courses.ranking[0].course_id, 'course-1');
  assert.equal(metrics.lw_most_popular_courses.ranking[0].enrollment_count, 1);

  assert.equal(metrics.lw_enrollees.supportState, 'partial');
  assert.equal(metrics.lw_enrollees.value, 2);

  assert.equal(metrics.lw_active_users.supportState, 'partial');
  assert.equal(metrics.lw_active_users.value, 1);
  assert.equal(metrics.lw_active_users.timestampRule, 'last_activity_at || completed_at');

  assert.equal(metrics.lw_average_time_spent_in_courses.supportState, 'partial');
  assert.equal(metrics.lw_average_time_spent_in_courses.value, 720);

  assert.equal(metrics.lw_most_engaging_courses.supportState, 'partial');
  assert.equal(metrics.lw_most_engaging_courses.ranking[0].course_id, 'course-1');
  assert.equal(metrics.lw_most_engaging_courses.ranking[0].average_time_spent_seconds, 720);

  assert.equal(metrics.lw_most_dropped_out_courses.supportState, 'partial');
  assert.equal(metrics.lw_most_dropped_out_courses.ranking[0].course_id, 'course-1');
  assert.equal(metrics.lw_most_dropped_out_courses.ranking[0].dropout_candidates, 1);
  assert.equal(metrics.lw_most_dropped_out_courses.ranking[0].active_progress_rows, 1);
});
