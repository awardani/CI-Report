import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLearnWorldsFilters, getLearnWorldsFilterOptions } from '../src/learnworlds/filtering.js';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { createLearnWorldsFixtureDatasets } from './fixtures/learnworldsFixtures.js';

test('LearnWorlds filtering returns source-specific filter options and applies course-scoped filters', () => {
  const normalized = normalizeLearnWorldsDatasets(createLearnWorldsFixtureDatasets());
  const options = getLearnWorldsFilterOptions(normalized);

  assert.equal(options.courses.length, 2);
  assert.ok(options.authors.includes('Team Learn'));
  assert.ok(options.categories.includes('Automation'));
  assert.ok(options.accessTypes.includes('paid'));

  const filtered = applyLearnWorldsFilters(normalized, {
    courseIds: ['course-1'],
    authors: [],
    categories: [],
    accessTypes: [],
  });

  assert.equal(filtered.lw_courses.length, 1);
  assert.equal(filtered.lw_courses[0].course_id, 'course-1');
  assert.equal(filtered.lw_enrollments.length, 1);
  assert.equal(filtered.lw_course_progress.length, 1);
  assert.equal(filtered.lw_activity_analytics.length, 1);
  assert.equal(filtered.lw_users.length, 1);
});
