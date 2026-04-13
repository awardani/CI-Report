const formatCount = (value) => value.toLocaleString();

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return 'Unavailable';
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const datePart = (timestamp) => (timestamp ? timestamp.slice(0, 10) : null);

const inDateRange = (timestamp, filters) => {
  const value = datePart(timestamp);

  if (!value) {
    return false;
  }

  if (filters.startDate && value < filters.startDate) {
    return false;
  }

  if (filters.endDate && value > filters.endDate) {
    return false;
  }

  return true;
};

const getProgressActivityTimestamp = (row) => row.last_activity_at || row.completed_at || null;

const buildCountMetricResult = ({
  id,
  label,
  value,
  timestampField,
  supportState,
  assumptions = [],
  limitations = [],
  numerator = null,
  denominator = null,
}) => ({
  id,
  label,
  kind: 'count',
  value,
  displayValue: formatCount(value),
  numerator,
  denominator,
  timestampField,
  supportState,
  assumptions,
  limitations,
});

const buildDurationMetricResult = ({
  id,
  label,
  seconds,
  timestampField,
  supportState,
  assumptions = [],
  limitations = [],
  numerator = null,
  denominator = null,
}) => ({
  id,
  label,
  kind: 'duration',
  value: seconds,
  displayValue: formatDuration(seconds),
  numerator,
  denominator,
  timestampField,
  supportState,
  assumptions,
  limitations,
});

const buildRankingMetricResult = ({
  id,
  label,
  ranking,
  timestampField,
  supportState,
  assumptions = [],
  limitations = [],
}) => ({
  id,
  label,
  kind: 'ranking',
  ranking,
  value: ranking.length,
  displayValue: `${ranking.length} ranked`,
  numerator: null,
  denominator: null,
  timestampField,
  supportState,
  assumptions,
  limitations,
});

const buildBlockedMetricResult = ({
  id,
  label,
  timestampField,
  supportState = 'blocked',
  assumptions = [],
  limitations = [],
  proposedRule = null,
}) => ({
  id,
  label,
  kind: 'blocked',
  value: null,
  displayValue: 'Unavailable',
  numerator: null,
  denominator: null,
  timestampField,
  supportState,
  assumptions,
  limitations,
  proposedRule,
});

const buildCourseEnrollmentRanking = (normalizedData, filters) => {
  const counts = new Map();
  let missingEnrollmentDates = 0;

  normalizedData.lw_enrollments.forEach((enrollment) => {
    if (!enrollment.course_id) {
      return;
    }

    if (!enrollment.enrolled_at) {
      missingEnrollmentDates += 1;
      return;
    }

    if (!inDateRange(enrollment.enrolled_at, filters)) {
      return;
    }

    counts.set(enrollment.course_id, (counts.get(enrollment.course_id) || 0) + 1);
  });

  return {
    ranking: [...counts.entries()]
      .map(([courseId, enrollmentCount]) => {
        const course = normalizedData.indexes.coursesById.get(courseId);

        return {
          course_id: courseId,
          course_name: course?.course_name || courseId,
          course_url: course?.course_url || null,
          enrollment_count: enrollmentCount,
        };
      })
      .sort((left, right) => {
        if (right.enrollment_count !== left.enrollment_count) {
          return right.enrollment_count - left.enrollment_count;
        }

        return left.course_id.localeCompare(right.course_id);
      })
      .slice(0, 10),
    missingEnrollmentDates,
  };
};

const distinctActiveProgressRows = (normalizedData, filters) =>
  normalizedData.lw_course_progress.filter((row) => {
    const activityTimestamp = getProgressActivityTimestamp(row);

    if (!row.user_id || !row.course_id || !activityTimestamp) {
      return false;
    }

    return inDateRange(activityTimestamp, filters);
  });

const buildEngagementRanking = (normalizedData) => {
  const ranking = normalizedData.lw_activity_analytics
    .filter(
      (row) =>
        row.course_id &&
        row.course_found &&
        row.students &&
        row.students > 0 &&
        row.total_study_time_seconds !== null
    )
    .map((row) => {
      const course = normalizedData.indexes.coursesById.get(row.course_id);
      const averageTimeSpentSeconds = row.total_study_time_seconds / row.students;

      return {
        course_id: row.course_id,
        course_name: course?.course_name || row.course_id,
        course_url: course?.course_url || null,
        average_time_spent_seconds: Math.round(averageTimeSpentSeconds),
        students: row.students,
        total_study_time_seconds: row.total_study_time_seconds,
      };
    })
    .sort((left, right) => right.average_time_spent_seconds - left.average_time_spent_seconds)
    .slice(0, 10);

  return ranking;
};

const isDropoutCandidate = (progressRow) => {
  if (!progressRow || !progressRow.user_id || !progressRow.course_id) {
    return false;
  }

  if (progressRow.is_completed) {
    return false;
  }

  if (progressRow.progress_percent === null) {
    return false;
  }

  return progressRow.progress_percent > 0 && progressRow.progress_percent < 100;
};

const buildDropoutRanking = (normalizedData, filters) => {
  const courseStats = new Map();
  let missingEnrollmentDates = 0;
  let missingProgressJoins = 0;

  normalizedData.lw_enrollments.forEach((enrollment) => {
    if (!enrollment.user_id || !enrollment.course_id) {
      return;
    }

    if (!enrollment.enrolled_at) {
      missingEnrollmentDates += 1;
      return;
    }

    if (!inDateRange(enrollment.enrolled_at, filters)) {
      return;
    }

    const key = `${enrollment.user_id}:${enrollment.course_id}`;
    const progressRow = normalizedData.indexes.progressByUserCourseKey.get(key);

    if (!progressRow) {
      missingProgressJoins += 1;
      return;
    }

    const course = normalizedData.indexes.coursesById.get(enrollment.course_id);
    const current = courseStats.get(enrollment.course_id) || {
      course_id: enrollment.course_id,
      course_name: course?.course_name || enrollment.course_id,
      course_url: course?.course_url || null,
      dropout_candidates: 0,
      active_progress_rows: 0,
      dropout_rate: 0,
    };

    current.active_progress_rows += 1;

    if (isDropoutCandidate(progressRow)) {
      current.dropout_candidates += 1;
    }

    current.dropout_rate = current.active_progress_rows
      ? current.dropout_candidates / current.active_progress_rows
      : 0;

    courseStats.set(enrollment.course_id, current);
  });

  return {
    ranking: [...courseStats.values()]
      .sort((left, right) => {
        if (right.dropout_rate !== left.dropout_rate) {
          return right.dropout_rate - left.dropout_rate;
        }

        return right.dropout_candidates - left.dropout_candidates;
      })
      .slice(0, 10),
    missingEnrollmentDates,
    missingProgressJoins,
  };
};

export const learnWorldsMetricSpecs = [
  {
    id: 'lw_new_registrations',
    label: 'New registrations',
    numerator: 'Users with created_at during the selected period',
    denominator: null,
    timestampRule: 'created_at',
    tooltip: {
      meaning: 'Users created during the selected period.',
    },
    calculate(normalizedData, filters) {
      const value = normalizedData.lw_users.filter(
        (user) => Boolean(user.user_id) && inDateRange(user.created_at, filters)
      ).length;

      return buildCountMetricResult({
        id: this.id,
        label: this.label,
        value,
        timestampField: 'created_at',
        supportState: 'full',
        assumptions: ['Uses lw_users.created_at as the registration timestamp.'],
        limitations: [],
      });
    },
  },
  {
    id: 'lw_most_popular_courses',
    label: 'Most popular courses',
    numerator: 'Enrollment rows grouped by course in the selected period',
    denominator: null,
    timestampRule: 'enrolled_at',
    tooltip: {
      meaning: 'Courses ranked by enrollment count in the selected period.',
    },
    calculate(normalizedData, filters) {
      const { ranking, missingEnrollmentDates } = buildCourseEnrollmentRanking(normalizedData, filters);

      return buildRankingMetricResult({
        id: this.id,
        label: this.label,
        ranking,
        timestampField: 'enrolled_at',
        supportState: missingEnrollmentDates > 0 ? 'partial' : 'full',
        assumptions: ['Ranks courses by enrollment rows whose enrolled_at falls in the selected period.'],
        limitations:
          missingEnrollmentDates > 0
            ? ['Some enrollment rows are missing enrolled_at and are excluded from the ranking.']
            : [],
      });
    },
  },
  {
    id: 'lw_enrollees',
    label: 'Enrollees',
    numerator: 'Enrollment rows during the selected period',
    denominator: null,
    timestampRule: 'enrolled_at',
    tooltip: {
      meaning: 'Enrollment count during the selected period.',
    },
    calculate(normalizedData, filters) {
      const validEnrollmentRows = normalizedData.lw_enrollments.filter(
        (row) => Boolean(row.enrolled_at) && inDateRange(row.enrolled_at, filters)
      );
      const missingEnrollmentDates = normalizedData.lw_enrollments.filter((row) => !row.enrolled_at).length;

      return buildCountMetricResult({
        id: this.id,
        label: this.label,
        value: validEnrollmentRows.length,
        timestampField: 'enrolled_at',
        supportState: missingEnrollmentDates > 0 ? 'partial' : 'full',
        assumptions: ['Counts enrollment rows using enrolled_at from the user-courses API response.'],
        limitations:
          missingEnrollmentDates > 0
            ? ['Some enrollment rows are missing enrolled_at and are excluded from the count.']
            : [],
      });
    },
  },
  {
    id: 'lw_active_users',
    label: 'Active users',
    numerator: 'Distinct users with course progress rows whose last_activity_at or completed_at falls in the selected period',
    denominator: null,
    timestampRule: 'last_activity_at || completed_at',
    tooltip: {
      meaning: 'Distinct learners with dated course progress activity in the selected period.',
    },
    calculate(normalizedData, filters) {
      const activeRows = distinctActiveProgressRows(normalizedData, filters);
      const distinctUsers = new Set(activeRows.map((row) => row.user_id).filter(Boolean));
      const rowsMissingActivityTimestamp = normalizedData.lw_course_progress.filter(
        (row) => !getProgressActivityTimestamp(row)
      ).length;

      if (activeRows.length === 0 && normalizedData.lw_course_progress.length > 0 && rowsMissingActivityTimestamp === normalizedData.lw_course_progress.length) {
        return buildBlockedMetricResult({
          id: this.id,
          label: this.label,
          timestampField: 'last_activity_at || completed_at',
          supportState: 'blocked',
          assumptions: [
            'Active users should be based on dated progress activity, not account existence.',
          ],
          limitations: [
            'Current progress rows do not include last_activity_at or completed_at values, so period-based active-user counts cannot be calculated yet.',
          ],
          proposedRule:
            'Count distinct users with a course progress row whose last_activity_at falls in the selected period, falling back to completed_at when the course was completed.',
        });
      }

      return buildCountMetricResult({
        id: this.id,
        label: this.label,
        value: distinctUsers.size,
        numerator: distinctUsers.size,
        denominator: null,
        timestampField: 'last_activity_at || completed_at',
        supportState: rowsMissingActivityTimestamp > 0 ? 'partial' : 'full',
        assumptions: [
          'Uses progress activity timestamps first and falls back to completed_at when present.',
        ],
        limitations:
          rowsMissingActivityTimestamp > 0
            ? ['Progress rows without last_activity_at or completed_at are excluded from the metric.']
            : [],
      });
    },
  },
  {
    id: 'lw_average_time_spent_in_courses',
    label: 'Average time spent in courses',
    numerator: 'Total study time from course analytics',
    denominator: 'Learners counted in course analytics',
    timestampRule: 'course analytics snapshot',
    tooltip: {
      meaning: 'Average study time per learner from the current course analytics snapshot.',
    },
    calculate(normalizedData) {
      const qualifyingRows = normalizedData.lw_activity_analytics.filter(
        (row) =>
          row.course_found &&
          row.students &&
          row.students > 0 &&
          row.total_study_time_seconds !== null
      );

      if (qualifyingRows.length === 0) {
        return buildBlockedMetricResult({
          id: this.id,
          label: this.label,
          timestampField: 'course analytics snapshot',
          supportState: 'blocked',
          assumptions: [
            'Average time spent is defined as total study time divided by learners in the analytics snapshot.',
          ],
          limitations: [
            'Current course analytics rows do not include enough study-time data to calculate the metric.',
          ],
        });
      }

      const totalStudyTimeSeconds = qualifyingRows.reduce(
        (sum, row) => sum + row.total_study_time_seconds,
        0
      );
      const totalLearners = qualifyingRows.reduce((sum, row) => sum + row.students, 0);

      return buildDurationMetricResult({
        id: this.id,
        label: this.label,
        seconds: totalLearners > 0 ? totalStudyTimeSeconds / totalLearners : 0,
        numerator: totalStudyTimeSeconds,
        denominator: totalLearners,
        timestampField: 'course analytics snapshot',
        supportState: 'partial',
        assumptions: [
          'Average time spent is calculated per learner from current course analytics rows.',
        ],
        limitations: [
          'LearnWorlds course analytics are snapshot-based and are not attributable to the selected date range.',
        ],
      });
    },
  },
  {
    id: 'lw_most_engaging_courses',
    label: 'Most engaging courses',
    numerator: 'Average study time per learner by course',
    denominator: null,
    timestampRule: 'course analytics snapshot',
    tooltip: {
      meaning: 'Courses ranked by average study time per learner.',
    },
    calculate(normalizedData) {
      const ranking = buildEngagementRanking(normalizedData);

      if (ranking.length === 0) {
        return buildBlockedMetricResult({
          id: this.id,
          label: this.label,
          timestampField: 'course analytics snapshot',
          supportState: 'blocked',
          assumptions: [
            'Engagement should be ranked by average study time per learner.',
          ],
          limitations: [
            'Current course analytics rows do not include enough study-time data to rank courses.',
          ],
        });
      }

      return buildRankingMetricResult({
        id: this.id,
        label: this.label,
        ranking,
        timestampField: 'course analytics snapshot',
        supportState: 'partial',
        assumptions: [
          'Ranks courses by total_study_time_seconds / students from course analytics.',
        ],
        limitations: [
          'Course analytics are snapshot-based and are not attributable to the selected date range.',
        ],
      });
    },
  },
  {
    id: 'lw_most_dropped_out_courses',
    label: 'Most dropped out courses',
    numerator: 'Dropout-candidate learner-course progress rows by course',
    denominator: 'Learner-course progress rows joined to enrollments in the selected period',
    timestampRule: 'enrolled_at',
    tooltip: {
      meaning: 'Courses ranked by a conservative dropout proxy from incomplete progress.',
    },
    calculate(normalizedData, filters) {
      const { ranking, missingEnrollmentDates, missingProgressJoins } = buildDropoutRanking(
        normalizedData,
        filters
      );

      if (ranking.length === 0) {
        return buildBlockedMetricResult({
          id: this.id,
          label: this.label,
          timestampField: 'enrolled_at',
          supportState: 'blocked',
          assumptions: [
            'Dropout should be measured on enrolled learner-course cohorts with usable progress rows.',
          ],
          limitations: [
            'Current LearnWorlds data does not provide enough enrollment-progress overlap to rank dropout candidates yet.',
          ],
          proposedRule:
            'Rank courses by dropout-candidate rate, where a dropout candidate is an enrolled learner with progress above 0% and below 100% who has not completed the course.',
        });
      }

      const limitations = [
        'This is a conservative dropout proxy based on incomplete progress snapshots, not a true dropout event.',
      ];

      if (missingEnrollmentDates > 0) {
        limitations.push('Enrollments without enrolled_at are excluded from the dropout cohort.');
      }

      if (missingProgressJoins > 0) {
        limitations.push('Enrollments without matching progress rows are excluded from the dropout ranking.');
      }

      return buildRankingMetricResult({
        id: this.id,
        label: this.label,
        ranking,
        timestampField: 'enrolled_at',
        supportState: 'partial',
        assumptions: [
          'A dropout candidate is a learner with progress_percent greater than 0 and less than 100 who has not completed the course.',
          'Courses are ranked by dropout-candidate rate within the selected enrollment cohort.',
        ],
        limitations,
      });
    },
  },
];

export const learnWorldsDerivationProposals = {
  lw_dropout_stage_analytics: {
    metricName: 'Dropout stage analytics',
    requiredFields: [
      'per-activity completion sequence',
      'per-activity last interacted timestamp',
      'section or activity order within each course',
      'course progress snapshots over time or event history',
    ],
    missingFields: [
      'activity-level progress rows',
      'dated learner-level activity events',
      'stage-specific dropout markers',
    ],
    supportState: 'blocked',
    limitation:
      'Current LearnWorlds data is not sufficient for dropout stage analytics because it does not expose learner-level activity progression by course stage over time.',
  },
};

export const learnWorldsMetricSpecsById = Object.fromEntries(
  learnWorldsMetricSpecs.map((spec) => [spec.id, spec])
);

export const calculateLearnWorldsMetricSet = (normalizedData, filters, metricIds = null) => {
  const selectedSpecs = metricIds
    ? learnWorldsMetricSpecs.filter((spec) => metricIds.includes(spec.id))
    : learnWorldsMetricSpecs;

  return selectedSpecs.reduce((accumulator, spec) => {
    accumulator[spec.id] = {
      ...spec.calculate(normalizedData, filters),
      metricName: spec.label,
      numeratorDefinition: spec.numerator,
      denominatorDefinition: spec.denominator,
      timestampRule: spec.timestampRule,
    };
    return accumulator;
  }, {});
};
