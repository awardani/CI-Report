const buildWarnings = ({
  sourceRows,
  joinStats,
  syntheticEnrollmentIdCount,
  nullEnrollmentDateCount,
  missingTimestampCounts,
  progressStats,
  activityAnalyticsStats,
}) => {
  const warnings = [];

  if (missingTimestampCounts.users_created_at > 0) {
    warnings.push(`LearnWorlds users missing created_at: ${missingTimestampCounts.users_created_at}`);
  }

  if (missingTimestampCounts.courses_created_at > 0) {
    warnings.push(`LearnWorlds courses missing created_at: ${missingTimestampCounts.courses_created_at}`);
  }

  if (missingTimestampCounts.courses_updated_at > 0) {
    warnings.push(`LearnWorlds courses missing updated_at: ${missingTimestampCounts.courses_updated_at}`);
  }

  if (missingTimestampCounts.enrollments_enrolled_at > 0) {
    warnings.push(`LearnWorlds enrollments missing enrolled_at: ${missingTimestampCounts.enrollments_enrolled_at}`);
  }

  if (joinStats.enrollmentsMissingUserJoin > 0) {
    warnings.push(`LearnWorlds enrollments missing user join: ${joinStats.enrollmentsMissingUserJoin}`);
  }

  if (joinStats.enrollmentsMissingCourseJoin > 0) {
    warnings.push(`LearnWorlds enrollments missing course join: ${joinStats.enrollmentsMissingCourseJoin}`);
  }

  if (syntheticEnrollmentIdCount > 0) {
    warnings.push(`LearnWorlds synthetic enrollment ids detected: ${syntheticEnrollmentIdCount}`);
  }

  if (nullEnrollmentDateCount > 0) {
    warnings.push(`LearnWorlds enrollments with null enrolled_at: ${nullEnrollmentDateCount}`);
  }

  if (progressStats.missingUserIdCount > 0) {
    warnings.push(`LearnWorlds progress rows missing user_id: ${progressStats.missingUserIdCount}`);
  }

  if (progressStats.missingCourseIdCount > 0) {
    warnings.push(`LearnWorlds progress rows missing course_id: ${progressStats.missingCourseIdCount}`);
  }

  if (progressStats.invalidProgressPercentCount > 0) {
    warnings.push(
      `LearnWorlds progress rows with invalid progress_percent: ${progressStats.invalidProgressPercentCount}`
    );
  }

  if (progressStats.invalidProgressStatusCount > 0) {
    warnings.push(
      `LearnWorlds progress rows with unsupported progress_status: ${progressStats.invalidProgressStatusCount}`
    );
  }

  if (progressStats.missingTimeSpentCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing time_spent_seconds: ${progressStats.missingTimeSpentCount}`
    );
  }

  if (progressStats.missingLastActivityCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing last_activity_at: ${progressStats.missingLastActivityCount}`
    );
  }

  if (progressStats.brokenUserJoinCount > 0) {
    warnings.push(`LearnWorlds progress rows missing user join: ${progressStats.brokenUserJoinCount}`);
  }

  if (progressStats.brokenCourseJoinCount > 0) {
    warnings.push(
      `LearnWorlds progress rows missing course join: ${progressStats.brokenCourseJoinCount}`
    );
  }

  if (activityAnalyticsStats.missingCourseIdCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing course_id: ${activityAnalyticsStats.missingCourseIdCount}`
    );
  }

  if (activityAnalyticsStats.missingTimeSpentCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing time-spent fields: ${activityAnalyticsStats.missingTimeSpentCount}`
    );
  }

  if (activityAnalyticsStats.missingLastActivityCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing last_activity_at: ${activityAnalyticsStats.missingLastActivityCount}`
    );
  }

  if (activityAnalyticsStats.brokenCourseJoinCount > 0) {
    warnings.push(
      `LearnWorlds activity analytics rows missing course join: ${activityAnalyticsStats.brokenCourseJoinCount}`
    );
  }

  if (activityAnalyticsStats.missingActivityIdentityCount > 0) {
    warnings.push(
      'LearnWorlds activity analytics rows currently use course-level aggregates without activity_id/name/type.'
    );
  }

  if (sourceRows.userRows === 0) {
    warnings.push('LearnWorlds userRows is empty.');
  }

  if (sourceRows.courseRows === 0) {
    warnings.push('LearnWorlds courseRows is empty.');
  }

  if (sourceRows.enrollmentRows === 0) {
    warnings.push('LearnWorlds enrollmentRows is empty.');
  }

  if (sourceRows.progressRows === 0) {
    warnings.push('LearnWorlds progressRows is empty.');
  }

  if (sourceRows.activityAnalyticsRows === 0) {
    warnings.push('LearnWorlds activityAnalyticsRows is empty.');
  }

  return warnings;
};

export const validateLearnWorldsData = (datasets, normalizedData) => {
  const supportedProgressStates = new Set([
    'completed',
    'passed',
    'in_progress',
    'not_started',
    'started',
    'failed',
    'pending',
    'locked',
  ]);

  const sourceRows = {
    userRows: datasets.userRows.length,
    courseRows: datasets.courseRows.length,
    enrollmentRows: datasets.enrollmentRows.length,
    progressRows: datasets.progressRows.length,
    activityAnalyticsRows: datasets.activityAnalyticsRows.length,
  };

  const normalizedRows = {
    lw_users: normalizedData.lw_users.length,
    lw_courses: normalizedData.lw_courses.length,
    lw_enrollments: normalizedData.lw_enrollments.length,
    lw_course_progress: normalizedData.lw_course_progress.length,
    lw_activity_analytics: normalizedData.lw_activity_analytics.length,
  };

  const idStats = {
    usersMissingId: normalizedData.lw_users.filter((row) => !row.user_id).length,
    coursesMissingId: normalizedData.lw_courses.filter((row) => !row.course_id).length,
    enrollmentsMissingId: normalizedData.lw_enrollments.filter((row) => !row.enrollment_id).length,
  };

  const missingTimestampCounts = {
    users_created_at: normalizedData.lw_users.filter((row) => !row.created_at).length,
    courses_created_at: normalizedData.lw_courses.filter((row) => !row.created_at).length,
    courses_updated_at: normalizedData.lw_courses.filter((row) => !row.updated_at).length,
    enrollments_enrolled_at: normalizedData.lw_enrollments.filter((row) => !row.enrolled_at).length,
  };

  const joinStats = {
    enrollmentsMissingUserJoin: normalizedData.lw_enrollments.filter((row) => !row.user_found).length,
    enrollmentsMissingCourseJoin: normalizedData.lw_enrollments.filter((row) => !row.course_found).length,
  };

  const syntheticEnrollmentIdCount = normalizedData.lw_enrollments.filter(
    (row) => row.enrollment_id_is_synthetic
  ).length;

  const nullEnrollmentDateCount = normalizedData.lw_enrollments.filter(
    (row) => row.enrolled_at === null
  ).length;

  const validUserIds = new Set(normalizedData.lw_users.map((row) => row.user_id).filter(Boolean));
  const validCourseIds = new Set(normalizedData.lw_courses.map((row) => row.course_id).filter(Boolean));

  const progressStats = {
    missingUserIdCount: normalizedData.lw_course_progress.filter((row) => !row.user_id).length,
    missingCourseIdCount: normalizedData.lw_course_progress.filter((row) => !row.course_id).length,
    invalidProgressPercentCount: normalizedData.lw_course_progress.filter((row) => {
      if (row.progress_percent === null || row.progress_percent === undefined) {
        return true;
      }
      return row.progress_percent < 0 || row.progress_percent > 100;
    }).length,
    invalidProgressStatusCount: normalizedData.lw_course_progress.filter(
      (row) => row.progress_status && !supportedProgressStates.has(row.progress_status)
    ).length,
    missingTimeSpentCount: normalizedData.lw_course_progress.filter(
      (row) => row.time_spent_seconds === null || row.time_spent_seconds === undefined
    ).length,
    missingLastActivityCount: normalizedData.lw_course_progress.filter((row) => !row.last_activity_at).length,
    brokenUserJoinCount: normalizedData.lw_course_progress.filter(
      (row) => row.user_id && !validUserIds.has(row.user_id)
    ).length,
    brokenCourseJoinCount: normalizedData.lw_course_progress.filter(
      (row) => row.course_id && !validCourseIds.has(row.course_id)
    ).length,
  };

  const activityAnalyticsStats = {
    missingCourseIdCount: normalizedData.lw_activity_analytics.filter((row) => !row.course_id).length,
    missingTimeSpentCount: normalizedData.lw_activity_analytics.filter(
      (row) =>
        (row.total_study_time_seconds === null || row.total_study_time_seconds === undefined) &&
        (row.avg_time_to_finish_seconds === null || row.avg_time_to_finish_seconds === undefined)
    ).length,
    missingLastActivityCount: normalizedData.lw_activity_analytics.filter((row) => !row.last_activity_at).length,
    brokenCourseJoinCount: normalizedData.lw_activity_analytics.filter(
      (row) => row.course_id && !validCourseIds.has(row.course_id)
    ).length,
    missingActivityIdentityCount: normalizedData.lw_activity_analytics.filter(
      (row) => !row.activity_id && !row.activity_name && !row.activity_type
    ).length,
  };

  return {
    sourceRows,
    normalizedRows,
    idStats,
    missingTimestampCounts,
    joinStats,
    syntheticEnrollmentIdCount,
    nullEnrollmentDateCount,
    progressStats,
    activityAnalyticsStats,
    warnings: buildWarnings({
      sourceRows,
      joinStats,
      syntheticEnrollmentIdCount,
      nullEnrollmentDateCount,
      missingTimestampCounts,
      progressStats,
      activityAnalyticsStats,
    }),
  };
};
