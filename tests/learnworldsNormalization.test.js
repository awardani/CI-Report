import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { createLearnWorldsFixtureDatasets } from './fixtures/learnworldsFixtures.js';

test('LearnWorlds normalization builds users, courses, enrollments, progress, and analytics with stable fields', () => {
  const normalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());

  assert.equal(normalized.lw_users.length, 3);
  assert.equal(normalized.lw_courses.length, 2);
  assert.equal(normalized.lw_enrollments.length, 3);
  assert.equal(normalized.lw_course_progress.length, 2);
  assert.equal(normalized.lw_activity_analytics.length, 2);

  assert.equal(normalized.lw_users[0].user_id, 'user-1');
  assert.equal(normalized.lw_courses[0].course_name, 'Seller 365');
  assert.equal(normalized.lw_enrollments[0].enrollment_id_is_synthetic, true);
  assert.equal(normalized.lw_enrollments[0].user_found, true);
  assert.equal(normalized.lw_enrollments[2].user_found, false);
  assert.equal(normalized.lw_course_progress[0].progress_status, 'in_progress');
  assert.equal(normalized.lw_course_progress[0].is_completed, false);
  assert.equal(normalized.lw_activity_analytics[0].students, 10);
  assert.equal(normalized.dateBounds.user_created_at.minDate, '2026-01-02');
  assert.equal(normalized.dateBounds.course_created_at.maxDate, '2026-01-03');
  assert.equal(normalized.dateBounds.enrollment_created_at.minDate, '2026-01-03');
  assert.equal(normalized.dateBounds.progress_activity_at.minDate, '2026-01-15');
});
