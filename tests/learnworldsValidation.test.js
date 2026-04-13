import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearnWorldsDatasets } from '../src/learnworlds/normalization.js';
import { validateLearnWorldsData } from '../src/learnworlds/validation.js';
import { createLearnWorldsFixtureDatasets } from './fixtures/learnworldsFixtures.js';

test('LearnWorlds validation reports enrollment, progress, and analytics gaps', () => {
  const datasets = createLearnWorldsFixtureDatasets();
  const normalized = normalizeLearnWorldsDatasets(datasets);
  const report = validateLearnWorldsData(datasets, normalized);

  assert.equal(report.sourceRows.userRows, 3);
  assert.equal(report.sourceRows.progressRows, 2);
  assert.equal(report.sourceRows.activityAnalyticsRows, 2);
  assert.equal(report.normalizedRows.lw_enrollments, 3);
  assert.equal(report.idStats.usersMissingId, 1);
  assert.equal(report.missingTimestampCounts.users_created_at, 1);
  assert.equal(report.missingTimestampCounts.courses_updated_at, 1);
  assert.equal(report.missingTimestampCounts.enrollments_enrolled_at, 1);
  assert.equal(report.joinStats.enrollmentsMissingUserJoin, 1);
  assert.equal(report.syntheticEnrollmentIdCount, 3);
  assert.equal(report.nullEnrollmentDateCount, 1);
  assert.equal(report.progressStats.invalidProgressPercentCount, 1);
  assert.equal(report.progressStats.invalidProgressStatusCount, 1);
  assert.equal(report.progressStats.brokenUserJoinCount, 1);
  assert.equal(report.activityAnalyticsStats.missingTimeSpentCount, 1);
  assert.equal(report.activityAnalyticsStats.brokenCourseJoinCount, 1);
  assert.ok(report.warnings.some((warning) => warning.includes('synthetic enrollment ids')));
  assert.ok(report.warnings.some((warning) => warning.includes('progress rows with invalid progress_percent')));
});
